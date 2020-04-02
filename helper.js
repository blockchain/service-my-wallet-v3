
//Mainnet Transaction
function callMainnetNetwork(txHash, addr, contractAddr, nodeName, type) {

    var networkList = getMainnetNetwork();
    var customMainnnet = loadCustomNetwork('mainnet');
    
    networkList = $.merge(networkList, customMainnnet);
    var _network = networkList.filter(x => x.nodeName == nodeName);  
    var url = _network[0].url;

    if (_network[0].port)
        url += ':' + _network.port;

    if (type === 1)        
        return getCommonTransaction(url, txHash);
    else if (type === 2)
        return getCommonAddress(url, addr);
    else if (type == 3)
        return getCommonToken(url, addr, contractAddr)

}

function callTestnetNetwork(txHash, addr, contractAddr, nodeName, type) {

    var networkList = getTestnetNetwork();
    var customTestnnet = loadCustomNetwork('testnet');

    networkList = $.merge(networkList, customTestnnet);
    var _network = networkList.filter(x => x.nodeName == nodeName);
    var url = _network[0].url;

    if (_network[0].port)
        url += ':' + _network.port;

    if (type === 1)
        return getCommonTransaction(url, txHash);
    else if (type === 2)
        return getCommonAddress(url, addr);
    else if (type == 3)
        return getCommonToken(url, addr, contractAddr)

}

function getCommonTransaction(url, txHash) {
    return new Promise(function (resolve, reject) {

        commonAPI(url, 'eth_getTransactionByHash', [txHash])
            .then(function (data) {
                if (data.error)
                    reject(data.error);
                else if (data.result == null)
                    resolve(data);
                else {                    
                    var receipt = commonAPI(url, 'eth_getTransactionReceipt', [txHash]);
                    var block = commonAPI(url, 'eth_getBlockByNumber', [data.result.blockNumber, false]);
                    var latestBlock = commonAPI(url, 'eth_blockNumber', []);


                    $.when(receipt, block, latestBlock).done(function (_receipt, _block, _latestBlock) {
                        data.result.receipt = _receipt[0].result;
                        data.result.block = _block[0].result;
                        data.result.latestBlock = _latestBlock[0].result;

                        var totalCount = 0;
                        var tokens = [];
                        var tempTokens =[];
                        //get total transfer
                        $.each(_receipt[0].result.logs, function (key, log) {
                            if (log.topics[0] === '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef') {                       
                                tokens.push(log.address);                               
                                totalCount++;
                            }
                        });

                        if (totalCount > 0){                           
                            tokens = unique(tokens);

                            var tokenCount = 0;
                            $.each(tokens, function(i, v){
                                var symbol = commonAPI(url, 'eth_call', [{ "to": v, "data": "0x95d89b41" }, "latest"]);
                                var decimal = commonAPI(url, 'eth_call', [{ "to": v, "data": "0x313ce567" }, "latest"]);

                                $.when(symbol, decimal).done(function (_symbol, _decimal) {
                                    var tempSymbol = _symbol[0].result === "0x" ? "0x" : convertHex2a(_symbol[0].result.toString().substr(130));
                                    var tempDecimal = _decimal[0].result === "0x" ? "0x" : new BigNumber(_decimal[0].result).toString();
                                    tempTokens.push({ id: v, symbol: tempSymbol, decimal: tempDecimal });

                                    tokenCount++

                                    if (tokenCount == tokens.length) {                                                                 
                                        $.each(_receipt[0].result.logs, function (key, log) {
                                            if (log.topics[0] === '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef') {                                            
                                                var _token = tempTokens.filter(x => x.id === log.address);                                                
                                                                                                                                                         
                                                log.symbol = _token[0].symbol;
                                                log.decimal = _token[0].decimal;                                            
                                                                                                                                          
                                            }
                                        });

                                        return resolve(data);
                                
                                    }
                                })

                               
                            })

                        } else {
                            return resolve(data);
                        }                    
                    });
                }
            }, function (err){            
                reject(err);
            })
    })
}

function getCommonAddress(url, addr) {
    return new Promise(function (resolve, reject) {

        commonAPI(url, 'eth_getBalance', [addr, 'latest'])
            .then(function (data) {
                if (data.error)
                    reject(data.error);

                resolve(data);
            }, function (err, val){              
                reject(err);
            })

    })
}

function getCommonToken(url, addr, contractAddr) {
    return new Promise(function (resolve, reject) {

        var _data = "0x70a08231000000000000000000000000" + addr.replace("0x", "");
        commonAPI(url, 'eth_call', [{ "to": contractAddr, "data": _data }, 'latest'])
            .then(function (data) {
                if (data.error)
                    reject(data.error);
                else if (data.result == null)
                    resolve(data);
                else {
                    var symbol = commonAPI(url, 'eth_call', [{ "to": contractAddr, "data": "0x95d89b41" }, "latest"]);
                    var decimal = commonAPI(url, 'eth_call', [{ "to": contractAddr, "data": "0x313ce567" }, "latest"]);

                    $.when(symbol, decimal).done(function (_symbol, _decimal) {
                        data.symbol = _symbol[0].result === "0x" ? "0x" : convertHex2a(_symbol[0].result.toString().substr(130));
                        data.decimal = _decimal[0].result === "0x" ? "0x" : new BigNumber(_decimal[0].result).toString();
                        return resolve(data);
                    });
                }
            }, function (err, val){              
                reject(err);
            })

    })
}
