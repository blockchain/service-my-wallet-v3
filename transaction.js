$(document).ready(function () {
    var param = getParam('tx');

    checkNetwork();

    if (!$.isEmptyObject(param)) {
        $('#searchTx').val(param);
        getTransaction();
    }
});

$(document).on('click','.btn-go',function(){
    getTransaction();     
  });


function getTransaction() {
    $('.data-info').empty(); 
    positionFooter();

    var txHash = $('#searchTx').val();
    var selectedNetwork = getSelectedMainnet();
    var selectedTestNetwork = getSelectedTestnet(); 

    if (selectedNetwork.length === 0 && selectedTestNetwork.length === 0) {
        alert('Please select network');
        return;
    } else if (txHash.length === 0) {
        return;
    } else if (validateHash(64, txHash) === false) {

        if (txHash.length = 62) {
            txHash = '0x' + txHash;
            if (validateHash(64, '0x' + txHash) == false) {
                alert('Invalid txhash');
                return;
            }
        } else {
            alert('Invalid txhash');
            return;
        }

    }


    $('.loader').show();
    var count = 0;
    var totalSelectedNetwork = selectedNetwork.length + selectedTestNetwork.length;

    $.each(selectedNetwork, function (key, value) {
        callMainnetNetwork(txHash,'','', value,1)
            .then(function (data) {
                if (data.error) {
                    generateTxErr(data.error, value);
                } else {                   
                    generateTxInfo(data.result, value);
                }

                count++;

                if (count == totalSelectedNetwork) {
                    $('.loader').hide();
                    positionFooter();
                }

                
            }, function(err){
                generateTxErr(err.statusText, value);

                count++;
                
                if (count == totalSelectedNetwork) {
                    $('.loader').hide();
                    positionFooter();
                }
            });
    });

    $('.loader').show();

    $.each(selectedTestNetwork, function (key, value) {
        callTestnetNetwork(txHash,'','', value,1)
            .then(function (data) {
                if (data.error) {
                    generateTxErr(data.error, value);
                } else {
                    
                    generateTxInfo(data.result, value);
                }

                count++;
                
                if (count == totalSelectedNetwork) {
                    $('.loader').hide();
                    positionFooter();
                }

            }, function(err){

                generateTxErr(err.statusText, value);

                count++;
                
                if (count == totalSelectedNetwork) {
                    $('.loader').hide();
                    positionFooter();
                }

            });
    })


}


function generateTxInfo(result, network) {

 
    try {
        var header = '<div class="card mt-3"> <div class="card-body"> <h5 class="card-title">{{network}}</h5>';
        var output = '';
    
        if (result == null) {
            header += '<div class="row"><div class="col-sm-12">Transaction not found</div></div>';
            output = header.replace('{{network}}', network);
        } else {
    
            var lbl = '<div class="row mb-1"><div class="col-sm-3">{{label}}:</div><div class="col-sm-9" style="word-wrap: break-word;">{{value}}</div></div>';
            var receipt = result.receipt;
            var block = result.block;
            var latestBlock = result.latestBlock;
    
            output = header.replace('{{network}}', network);
    
            var confirmationBlock = new BigNumber(latestBlock) - new BigNumber(block.number);
            var url = 'etherscan.io';
    
            if (network.indexOf('kovan') > -1)
                url = 'kovan.' + url;
            else if (network.indexOf('ropsten') > -1)
                url = 'ropsten.' + url;
            else if (network.indexOf('rinkeby') > -1)
                url = 'rinkeby.' + url;
            else if (network.indexOf('goerli') > -1)
                url = 'goerli.' + url;
            
            var txHashUrl ='<a href="https://' + url +'/tx/' + result.hash + '">' + result.hash + '</a>';
    
            output += lbl.replace('{{label}}', 'TxHash').replace('{{value}}', txHashUrl);
            output += lbl.replace('{{label}}', 'Status').replace('{{value}}', receipt.status == '0x1' ? '<span class="badge badge-success">Success</span>' : '<span class="badge badge-danger">Fail</span>');
            output += lbl.replace('{{label}}', 'Block Height').replace('{{value}}', '<a href="https://' + url + '/block/' + new BigNumber(block.number).toString() + '" rel="nofollow">' + new BigNumber(block.number).toString() + '</a> (' + confirmationBlock.toString() + ' block confirmations)');
            output += lbl.replace('{{label}}', 'From').replace('{{value}}', '<a href="https://' + url + '/address/' + result.from + '" rel="nofollow">' + result.from + '</a>');
            output += lbl.replace('{{label}}', 'To').replace('{{value}}', '<a href="https://' + url + '/address/' + result.to + '" rel="nofollow">' + result.to + '</a>');
            output += lbl.replace('{{label}}', 'Value').replace('{{value}}', getEtherValue(result.value).toString() + ' Ether');
    
            if (result.input !== '0x') {
    
                if (receipt.logs.length > 0) {
                    var tokenTransfer = '';
    
                  
                    $.each(receipt.logs, function (key, log) {
                        if (log.topics[0] === '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef') {
                          
                            var ffrom = '';
                            var tto = '';
    
                            if (log.topics[1])
                                ffrom = '<a class="address-tag" href="https://' + url + '/address/' + convertHex2Addr(log.topics[1]) + '" rel="nofollow">' + convertHex2Addr(log.topics[1]) + '</a>';
    
                            if (log.topics[2])
                                tto = '<a class="address-tag" href="https://' + url + '/address/' + convertHex2Addr(log.topics[2]) + '" rel="nofollow">' + convertHex2Addr(log.topics[2]) + '</a>';
    
                            if (log.topics[1] && log.topics[2]) {
                                tokenTransfer += 'From ' + ffrom + ' To ' + tto + ' for ';
    
                                if (log.topics[3]){
                                    tokenTransfer += new BigNumber(log.topics[3]).toString();
                                } else {
                                    tokenTransfer +=  convertDecimals(parseInt(log.decimal), new BigNumber(log.data)).toString();
                                }
                               
                                if (log.symbol !== "0x")
                                    tokenTransfer += ' <a href="https://' + url + '/token/' + result.to + '" rel="nofollow">' + log.symbol + '</a>';
        
                                if (tokenTransfer.length > 0)
                                    tokenTransfer += '<br />';
                            } else {
                                tokenTransfer = '<a href="https://' + url +'/tx/' + result.hash + '">View Transfer Details</a>';
                            }
                        }
                    });
    
    
                    if (tokenTransfer.length > 0)
                        output += lbl.replace('{{label}}', 'Token transfers').replace('{{value}}', tokenTransfer);
                }
            }
    
            output += lbl.replace('{{label}}', 'Gas Limit').replace('{{value}}', new BigNumber(result.gas).toString());
    
            var gasUsed = new BigNumber(receipt.gasUsed);
            var gasPrice = getEtherValue(result.gasPrice);
            var actualCost = gasUsed * gasPrice;
    
            output += lbl.replace('{{label}}', 'Gas Used').replace('{{value}}', gasUsed.toString());
            output += lbl.replace('{{label}}', 'Gas Price').replace('{{value}}', gasPrice.toString() + ' Ether ' + '(' + getGweiValue(result.gasPrice).toString() + ' Gwei)');
            output += lbl.replace('{{label}}', 'Tx Fee').replace('{{value}}', actualCost.toString() + ' Ether');
            output += "</div></div>";
    
        }
    
        $('.data-info').append(output);
    } catch (err) {
        generateTxErr(err, network);
    }
   

}

