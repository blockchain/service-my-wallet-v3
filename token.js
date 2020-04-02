$(document).ready(function () {
    var addr = getParam('a');
    var contractAddr = getParam('c');

    checkNetwork();

    if (!$.isEmptyObject(addr) && !$.isEmptyObject(contractAddr)) {
        $('#searchAddr').val(addr);
        $('#searchContractAddr').val(contractAddr);
        getToken();
    }

});

$(document).on('click','.btn-go',function(){
    getToken();       
  });


function getToken() {
    $('.data-info').empty(); 
    positionFooter();

    var addr = $('#searchAddr').val();
    var contractAddr = $('#searchContractAddr').val();
    var selectedNetwork = getSelectedMainnet();
    var selectedTestNetwork = getSelectedTestnet();

    if (selectedNetwork.length === 0 && selectedTestNetwork === 0){
        alert('Please select network');
        return;
    } else if ((addr.length === 0) || (contractAddr.length === 0)){
        return;
    } else if (validateHash(40, addr) === false){

        if (addr.length === 40 ){
            addr = '0x' + addr;
            if (validateHash(40, '0x' + addr) == false) {
                alert('Invalid Address');
                return;
            }
        } else {
            alert('Invalid Address');
            return;
        }     
    }  else if (validateHash(40, contractAddr) === false){

        if (contractAddr.length === 40 ){
            contractAddr = '0x' + contractAddr;
            if (validateHash(40, '0x' + contractAddr) == false) {
                alert('Invalid Contract Address');
                return;
            }
        } else {
            alert('Invalid Contract Address');
            return;
        }     
    }

    $('.loader').show();
    var count = 0;
    var totalSelectedNetwork = selectedNetwork.length + selectedTestNetwork.length;
  
    $.each(selectedNetwork, function (key, value) {     
        callMainnetNetwork('',addr, contractAddr, value, 3)
            .then(function (data) {
                if (data.error) {
                    generateTxErr(data.error, value);
                } else {
                    getEtherPrice(data.symbol, 'ETH')
                        .then(function (ethPrice) {                          
                            generateTokenInfo(data, value, ethPrice, contractAddr);
                        });                   
                }

                count++;

                if (count == totalSelectedNetwork) {
                    $('.loader').hide();
                    $('.datasource').show();
                    positionFooter();
                }

            }, function(err){
                generateTxErr(err.statusText, value);

                count++;
                
                if (count == totalSelectedNetwork) {
                    $('.loader').hide();
                    $('.datasource').show();
                    positionFooter();
                }
            });
    });

    $('.loader').show();

    $.each(selectedTestNetwork, function (key, value) {     
        callTestnetNetwork('',addr, contractAddr, value,3)
            .then(function (data) {
                if (data.error) {
                    generateTxErr(data.error, value);
                } else {
                    getEtherPrice(data.symbol, 'ETH')
                        .then(function (ethPrice) {                          
                            generateTokenInfo(data, value, ethPrice, contractAddr);
                        });
                }

                count++;

                if (count == totalSelectedNetwork) {
                    $('.loader').hide();
                    $('.datasource').show();
                    positionFooter();
                }

            }, function(err){
                generateTxErr(err.statusText, value);

                count++;
                
                if (count == totalSelectedNetwork) {
                    $('.loader').hide();
                    $('.datasource').show();
                    positionFooter();
                }
            });
    });


}


function generateTokenInfo(data, network, ethPrice, contractAddr) {

    try {
        var header = '<div class="card mt-3"> <div class="card-body"> <h5 class="card-title">{{network}}</h5>';
        var output = '';

        if (data.result == null) {
            eader += '<div class="row"><div class="col-sm-12">Token Balance not found</div></div>';
            output = header.replace('{{network}}', network);
        } else {
            var lbl = '<div class="row mb-1"><div class="col-sm-2">{{label}}:</div><div class="col-sm-9">{{value}}</div></div>';
            output = header.replace('{{network}}', network);

            var url = 'etherscan.io';

            if (network.indexOf('kovan') > -1)
                url = 'kovan.' + url;
            else if (network.indexOf('ropsten') > -1)
                url = 'ropsten.' + url;
            else if (network.indexOf('rinkeby') > -1)
                url = 'rinkeby.' + url;
            else if (network.indexOf('goerli') > -1)
                url = 'goerli.' + url;

            var balance = convertDecimals(parseInt(data.decimal), new BigNumber(data.result));
            var value = ethPrice.ETH ? new BigNumber(balance * ethPrice.ETH) + ' ETH  <font size="1">(@' + ethPrice.ETH + '/Eth)</font>' : '0.00000000';
            output += lbl.replace('{{label}}', 'Balance').replace('{{value}}', balance + ' <a href="https://' + url + '/token/' + contractAddr + '" rel="nofollow">' + data.symbol + '</a>');
            output += lbl.replace("{{label}}", 'Value').replace('{{value}}', value);
            output += lbl.replace("{{label}}", 'Decimal').replace('{{value}}', data.decimal);

        }

        $('.data-info').append(output);
    } catch (err) {
        generateTxErr(err, network);
    }

}