const fs = require('fs');
const log = require('fancy-log');
var colors = require('colors');
const dotenv = require('dotenv');
dotenv.config();
let dropBotAcct = process.env.BOT_ACCOUNT;
let botpostpriv = process.env.BOT_POSTING_PRIV;
let siteAccount = process.env.SITE_ACCOUNT;
let bankwif = process.env.SITE_ACTIVE_PRIV;
const hivejs = require('@hiveio/hive-js');
const SSC = require('sscjs');
const checker = new SSC("https://api.hive-engine.com/rpc/");
const io = require('@pm2/io')
io.init({
  transactions: true, // will enable the transaction tracing
  http: true // will enable metrics about the http server (optional)
})
const metadata = {"app": "DropBot v0.0.1 by @KLYE"};
const version = '0.0.1';
const authors = ['klye'];
const pid = process.pid;

log(`DropBot: Starting with pid: ${pid} - On Account @${dropBotAcct} - For @${siteAccount}`);

let watchList = [];
let offerList = [];
let paidList = []
let passedBlock;
let lastb;
let recentblock;
let blockNum;
let shutdown = false;
let debugmode = false;
let dropfee;
var newWatch;

class tokenDrop {
  constructor(token, max, each) {
    this.token = token;
    this.max = max;
    this.each = each;
    this.sent = 0;
  }
}

function randomString(length, chars) {
    var result = '';
    for (var i = length; i > 0; --i) result += chars[Math.floor(Math.random() * chars.length)];
    return result;
}
var rString = randomString(32, '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ');

if (process.argv[2] == undefined) {
    log(`DropBot: No Block Number Specified, Checking For Local Data`);
} else {
    log(`DropBot: Detected Start Argument Block #${process.argv[2]}`);
    passedBlock = process.argv[2];
}
//https://api.hive-roller.com/
//https://api.hive.blog/
var rpcserver = 'https://api.hive.blog/';
hivejs.api.setOptions({url: rpcserver});

var replycomment = function (wif, parentAuthor, parentPermlink, tippy, permlink, title, content, metadata, block) {
		if (debugmode == true) {
			console.log("║".blue + " DropBot " + " ~ DBUG".magenta.dim + " │ ".blue + "function ".magenta.dim + "replycomment".blue.bold + "(".white.dim + wif + "," + parentAuthor + "," + parentPermlink + "," + tippy + "," + permlink + "," + title + "," + content + "," + metadata + "," + blockNum + ")".white.dim);
		};
    if(block == undefined){
      block = blockNum;
    }

    hivejs.broadcast.comment(wif, parentAuthor, parentPermlink, tippy, permlink, title, content, metadata, function (commentfailz, commentwinz) {
      if (commentfailz) {
        if (debugmode == true) {
          console.log(commentfailz);
        };
        replycomment(wif, parentAuthor, parentPermlink, tippy, permlink, title, content, metadata);
      }; //END  if (commentfailz)
        if (commentwinz) {
          log(`DropBot: Sent a Message to @${parentAuthor} on Block #${blockNum}`);
          if (debugmode == true) {
            console.log(commentwinz);
          };
        }
      });

};//END replycomment

async function start() {
    try {
        log(`DropBot: Resuming at Block #${blockNum}`);
        parseBlock(blockNum);
    } catch (e) {
        log(`DropBot: ERROR: ${e}`);
        log(`DropBot: Restarting Block Parsing at Block #${blockNum}`);
        start(blockNum);
    }
}


function headBlock(block) {
  log(`DropBot: Head Block Height #${block}`);
}

function fetchHead() {
  hivejs.api.getDynamicGlobalProperties(function(err, result) {
      if (result) {
          var headb = result["last_irreversible_block_num"];
          headBlock(headb);
          return;
      }
  });
}

setInterval(function(){
  fetchHead();
}, 27000);

fetchHead();


if (passedBlock == undefined) {
    fs.readFile(__dirname + "dropbotblock.json", async function(err, lastblockdata) {
        if (err) {
            log('DropBot: Error Fetching Last Irreversible Block!');
            await hivejs.api.getDynamicGlobalProperties(function(err, result) {
              if(err) {
                log(`hivejs.api.getDynamicGlobalProperties ERROR`);
                log(err);
              }
                if (result) {
                    lastb = result["last_irreversible_block_num"];
                    log('DropBot: Last Block From Blockchain is ' + lastb);
                    blockNum = lastb;
                    setTimeout(start, 3000);
                };
            });
        } //END if(err)
        if (lastblockdata) {
          try{
            lastblockdata = JSON.parse(lastblockdata);
            log("DropBot: Last Block in DB is " + lastblockdata.lastblock);
            lastb = lastblockdata.lastblock;
            blockNum = lastb;
            setTimeout(start, 3000);
          } catch(e){
            log(`ERROR PARSING LASTBLOCKDATA`);
          }
        }
    });
} else {
    blockNum = passedBlock;
    return setTimeout(start, 3000);
}

async function bail(err) {
    if (err == undefined) {
        log(`BAIL: Bailing on Unknown / Undefined Error!`);
        log.error(err);
        process.exit(err === undefined ? 0 : 1);
    } else {
        log(`BAIL: Bailing on ${err}`);
        log.error(err);
        process.exit(err === undefined ? 0 : 1);
    }
}


async function sendTokens(op, newWatch, offerData, token, to, amount, dropfee) {
  var coin = token.toUpperCase();
  var sendAmt = amount;
  newWatch = op.data.parent_author + '/' + op.data.parent_permlink;
  var index = watchList.indexOf(newWatch);
  if(paidList[index].includes(to) > 0){
    var title = "You've Already Claimed!";
    var content = `@${to} are you trying to double claim a drop? Greedy Bastard!`;
    await replycomment(botpostpriv, op.data.parent_author, op.data.parent_permlink, dropBotAcct, op.data.permlink, title, content, metadata);
  }

  var totalSent = offerData['sent'] + sendAmt;
  if(totalSent >= offerData['max']) {
    sendAmt = offerData['max'] - offerData['sent'];
    if(sendAmt < 0){
      sendAmt = 0;
      newWatch = op.data.parent_author + '/' + op.data.parent_permlink;
      var index = watchList.indexOf(newWatch);
      if (index > -1) {
        watchList.splice(index, 1);
        offerList.splice(index, 1);
        paidList.splice(index, 1);
        return log(`DropBot: Giveaway Emptied! Removing from Arrays..`);
      }
    }
  } else {
    if((sendAmt + offerData['sent']) > offerData['max']){
      sendAmt = offerData['max'] - offerData['sent'];
      offerData['sent'] =
      newWatch = op.data.parent_author + '/' + op.data.parent_permlink;
      var index = watchList.indexOf(newWatch);
      if (index > -1) {
        watchList.splice(index, 1);
        offerList.splice(index, 1);
        paidList.splice(index, 1);
        log(`DropBot: Giveaway Emptied! Removing from Arrays..`);
      }
    }
  }

  var payload = {
      symbol: coin,
      to: to,
      quantity: sendAmt.toFixed(3),
      memo: 'DropBot Payout'
  }

  if(coin.toLowerCase() !== 'hive' && coin.toLowerCase() !== 'hbd'){
    var transfer_json = {"contractName":"tokens","contractAction":"transfer","contractPayload": {"symbol": coin, "to": to, "quantity": sendAmt.toFixed(3), "memo": payload.memo}};
    transfer_json = JSON.stringify(transfer_json);
    bankwif = JSON.stringify(bankwif);
    bankwif = JSON.parse(bankwif);
    bankwif = bankwif;
    hivejs.broadcast.customJson(bankwif, [siteAccount], // requiredAuths (for signing json with active key)
      [], 'ssc-mainnet-hive', transfer_json, function(err, result) {
        if(err){
          console.error(err)
          return console.log(`ERROR: Something fucked up! ${err}`)
        }
        if(result) {
          log(`DropBot: @${op.data.author} Claimed ${sendAmt} ${offerData.token}`); // on post:\nhttps://peakd.com/@${op.data.parent_author + '/' + op.data.parent_permlink}`);
          var index = watchList.indexOf(newWatch);
          if (index > -1) {
            paidList[index].push(to);
            offerList[index]['sent'] += sendAmt;
            if(offerList[index]['sent'] == offerList[index]['max']){
                watchList.splice(index, 1);
                offerList.splice(index, 1);
                paidList.splice(index, 1);
                log(`DropBot: Giveaway Emptied! Removing from Arrays..`);
            }
          }
        }
      });//END Broadcast
  } else {
    var transferCoinType;
if (coin == "hive") {
    transferCoinType = "HIVE";
}
if (coin == "hbd") {
    transferCoinType = "HBD";
}
hivejs.broadcast.transfer(bankwif, [siteAccount], to, parseFloat(sendAmt).toFixed(3) + " " + transferCoinType, payload.memo, function(fuckeduptransfer, senttransfer) {
    if (fuckeduptransfer) {
      log("WITHDRAW ERROR: Transfer Failed: " + fuckeduptransfer);
    };
    if (senttransfer) {

    }; //END senttransfer
  }); //END hive.js.broadcast.transfer
  }
};//END sendTokens

function parseBlock(blockNum) {
  if(blockNum == undefined) log(`parseBlock - blockNum UNDEFINED!`);
    hivejs.api.call('condenser_api.get_block', [blockNum], async function(err, block) {
        try {
            if (err !== null) {
                log(`DropBot: Failed to Fetch New Blocks After #${blockNum}`);
                log('DropBot: ERROR - ' + err);
                await timeout(9000);
                return setTimeout(() => parseBlock(blockNum));
            }
            if (block === null) {
                await timeout(9000);
                return setTimeout(() => parseBlock(blockNum));
            }
            if (block != undefined){
              blockJSON = JSON.stringify(block);
              blockNum++;
              fs.writeFileSync(__dirname + "dropbotblock.json", JSON.stringify({lastblock:blockNum}));
              recentblock = blockNum + 1;
              for (let transaction of block.transactions) {
                  for (let operation of transaction.operations) {
                      const action = operation[0];
                      if(action === "comment"){
                        const data = operation[1];
                        const op = {
                            action: action,
                            data: data
                        };
                        if (op.data.parent_author == siteAccount) {  //&& data.to === siteAccount
                          newWatch = op.data.parent_author + '/' + op.data.parent_permlink;
                          if(op.data.author === siteAccount){
                            if(op.data.body.includes(`@${dropBotAcct} drop`) > 0) {
                              var commentString = op.data.body.toLowerCase();
                              var commentParts = commentString.split(" ");
                              var tokenAmtRaw = commentParts[2];
                              var tokenSplit = tokenAmtRaw.split(":");
                              var tokenAmount = tokenSplit[0];
                              var tokenEach = tokenSplit[1];
                              var tokenType = commentParts[3];
                              var pdTemp = [];
                              tokenType = tokenType.toUpperCase();
                              newWatch = op.data.parent_author + '/' + op.data.parent_permlink;
                              var index = watchList.indexOf(newWatch);
                              if (index > -1) {
                                if (shutdown) return bail();
                                replycomment(botpostpriv, op.data.parent_author, op.data.parent_permlink, dropBotAcct, op.data.permlink, 'Already Watching Address', 'Already Watching this Post with a DropBot Instance', metadata);
                                setTimeout(() => parseBlock(blockNum));
                                log(`DropBot: Already Watching Address!`)
                              } else {
                                var newTokenOffer = new tokenDrop(tokenType, parseFloat(tokenAmount), parseFloat(tokenEach));
                                newWatch = op.data.parent_author + '/' + op.data.parent_permlink;
                                watchList.push(newWatch);
                                offerList.push(newTokenOffer);
                                paidList.push(pdTemp);
                                log(`DropBot: Now Watching Post for Claim Calls of ${tokenType} at location:\n\n@${newWatch}\n`);
                              }
                            }
                              if(op.data.body.includes(`@${dropBotAcct} stop`) > 0) {
                                newWatch = op.data.parent_author + '/' + op.data.parent_permlink;
                                var index = watchList.indexOf(newWatch);
                                if (index > -1) {
                                  watchList.splice(index, 1);
                                  offerList.splice(index, 1);
                                  paidList.splice(index, 1);
                                }
                              }

                              if((op.data.body.toLowerCase() === "status") > 0) {
                                log(`watchList`);
                                log(watchList);
                                log(`offerList`);
                                log(offerList);
                                log(`paidList`);
                                log(paidList);
                              }

                              if(op.data.body.toLowerCase() === `claim`){
                                newWatch = op.data.parent_author + '/' + op.data.parent_permlink;
                                var index = watchList.indexOf(newWatch);
                                var offerData;
                                if (index > -1) {
                                  offerData = offerList[index];
                                  sendTokens(op, newWatch, offerData, offerData.token, op.data.author, offerData.each);
                                } else {
                                  if (shutdown) return bail();
                                  setTimeout(() => parseBlock(blockNum));
                                }
                              }

                          } else {//END if op.data.author equals sietAccount
                            if (watchList.includes(newWatch) > 0) {
                              if(op.data.body.toLowerCase() === "claim"){
                                newWatch = op.data.parent_author + '/' + op.data.parent_permlink;
                                var index = watchList.indexOf(newWatch);
                                var offerData;
                                if (index > -1) {
                                  offerData = offerList[index];
                                }
                                sendTokens(op, newWatch, offerData, offerData.token, op.data.author, offerData.each);
                              }
                            } else {
                              log(`DropBot: @${op.data.author} Replied on post:\nhttps://peakd.com/@${op.data.parent_author + '/' + op.data.parent_permlink} which isn't a DropBot Post!`);
                            }
                          }
                        };
                      }
                  }//END for (let operation of transaction.operations)
              }//END for (let transaction of block.transactions)
            }
            if (shutdown) return bail();
            setTimeout(() => parseBlock(blockNum));
        } catch (e) {
            log(`bailing with ${e}`);
            return bail(e);
        }
    });
};//END parseBlock

//Kill App on Uncaught Exception
process.on('uncaughtException', function(err) {
    log('DropBot: ERROR: Crashed with Following Output:');
    console.error((new Date).toUTCString() + ' uncaughtException:', err.message);
    console.error(err.stack);
    console.error(`===================END===================`);
    process.exit(1);
});

function timeout(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
