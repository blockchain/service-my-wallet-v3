$(document).ready(function () {
    var param = getParam('a');
    
    checkNetwork();
    
    if (!$.isEmptyObject(param)) {
        $('#searchAddr').val(param);
        getAddress();
    }
    
});

$(document).on('click','.btn-go',function(){
    getAddress();       
  });



function getAddress() {
    $('.data-info').empty(); 
    positionFooter();

    var addr = $('#searchAddr').val();
    var selectedNetwork = getSelectedMainnet();
    var selectedTestNetwork = getSelectedTestnet();

    if (selectedNetwork.length === 0 && selectedTestNetwork === 0){
        alert('Please select network');
        return;
    } else if (addr.length === 0){
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
    }

  
    $('.loader').show();
    var count = 0;
    var totalSelectedNetwork = selectedNetwork.length + selectedTestNetwork.length;
  
    $.each(selectedNetwork, function (key, value) {
        callMainnetNetwork('', addr,'',value, 2)
            .then(function (data) {
                if (data.error) {
                    generateTxErr(data.error, value);
                } else {
                    getEtherPrice('ETH', 'BTC,USD,EUR')
                        .then(function (ethPrice) {
                            generateAddrInfo(data.result, value, ethPrice, addr);
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
        callTestnetNetwork('', addr,'',value, 2)
            .then(function (data) {
                if (data.error) {
                    generateTxErr(data.error, value);
                } else {
                    getEtherPrice('ETH', 'BTC,USD,EUR')
                        .then(function (ethPrice) {
                            generateAddrInfo(data.result, value, ethPrice, addr);
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

function generateAddrInfo(result, network, ethPrice, addr) {

    try {
        var header = '<div class="card mt-3"> <div class="card-body"> <h5 class="card-title">{{network}}</h5>';
        var output = '';

        if (result == null) {
            header += '<div class="row"><div class="col-sm-12">Address not found</div></div>';
            output = header.replace('{{network}}', network);
        } else {

            var lbl = '<div class="row mb-1"><div class="col-sm-2">{{label}}:</div><div class="col-sm-9">{{value}}</div></div>';

            output = header.replace('{{network}}', network);

            var _result = new BigNumber(result);
            var etherValue = getEtherValue(_result);
            var usdPrice = ethPrice.USD * etherValue;
            var eurPrice = ethPrice.EUR * etherValue;
            var btcPrice = ethPrice.BTC * etherValue;
            var url = 'etherscan.io';

            if (network.indexOf('kovan') > -1)
                url = 'kovan.' + url;
            else if (network.indexOf('ropsten') > -1)
                url = 'ropsten.' + url;
            else if (network.indexOf('rinkeby') > -1)
                url = 'rinkeby.' + url;
            else if (network.indexOf('goerli') > -1)
                url = 'goerli.' + url;

            var addrUrl = '<a href="https://' + url + '/address/' + addr + '">' + addr + '</a>';

            output += lbl.replace('{{label}}', 'Address').replace('{{value}}', addrUrl);
            output += lbl.replace('{{label}}', 'Balance').replace('{{value}}', etherValue + ' Ether');
<<<<<<< HEAD
            output += lbl.replace('{{label}}', 'Nonce').replace('{{value}}', addrNonce);
=======
>>>>>>> parent of 3056378... Merge pull request #10 from 409H/en-account_nonce
            output += lbl.replace('{{label}}', 'USD Value').replace('{{value}}', '$ ' + usdPrice.toFixed(2) + ' <font size="1">(@' + ethPrice.USD + '/Eth)</font>');
            output += lbl.replace('{{label}}', 'EUR Value').replace('{{value}}', '€ ' + eurPrice.toFixed(2) + ' <font size="1">(@' + ethPrice.EUR + '/Eth)</font>');
            output += lbl.replace('{{label}}', 'BTC Value').replace('{{value}}', btcPrice.toFixed(2) + ' Btc' + ' <font size="1">(@' + ethPrice.BTC + '/Eth)</font>');

        }

        $('.data-info').append(output);
    } catch (err) {
        generateTxErr(err, network);
    }



<<<<<<< HEAD
    return -1;
=======


>>>>>>> parent of 3056378... Merge pull request #10 from 409H/en-account_nonce
}