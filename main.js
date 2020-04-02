$(document).ready(function() {    
   
    $("#ethnetworkall").change(function() {
        if (this.checked) {
            $(".ethnetwork").each(function() {
                this.checked=true;
            });
        } else {
            $(".ethnetwork").each(function() {
                this.checked=false;
            });
        }
    });

    $(".ethnetwork").click(function () {
        if ($(this).is(":checked")) {
            var isAllChecked = 0;

            $(".ethnetwork").each(function() {
                if (!this.checked)
                    isAllChecked = 1;
            });

            if (isAllChecked == 0) {
                $("#ethnetworkall").prop("checked", true);
            }     
        }
        else {
            $("#ethnetworkall").prop("checked", false);
        }
    });

    $("#testnetworkall").change(function() {
        if (this.checked) {
            $(".testnetwork").each(function() {
                this.checked=true;
            });
        } else {
            $(".testnetwork").each(function() {
                this.checked=false;
            });
        }
    });

    $(".testnetwork").click(function () {
        if ($(this).is(":checked")) {
            var isAllChecked = 0;

            $(".testnetwork").each(function() {
                if (!this.checked)
                    isAllChecked = 1;
            });

            if (isAllChecked == 0) {
                $("#testnetworkall").prop("checked", true);
            }     
        }
        else {
            $("#testnetworkall").prop("checked", false);
        }
    });

    $(".customnode").click(function(){
        $('#addnode').modal('show');
        $('#nodenetwork').text($(this).data('id'));

    })

    $('#btnNode').click(function(){
        var nodeName = $('#txtNodeName').val();
        var url = $('#txtUrl').val();
        var port = $('#txtPort').val();
        var network = $('#nodenetwork').text();

        console.log(network);

        var nodeRegex = new RegExp("^[A-Za-z0-9? ,_-]+$");       
        if (!nodeRegex.test(nodeName)){
            alert('Invalid Node name');
            return;
        }
        
        var urlRegex = new RegExp('^(https?:\\/\\/)((([a-z\\d]([a-z\\d-]*[a-z\\d])*)\\.?)+[a-z]{2,}|((\\d{1,3}\\.){3}\\d{1,3}))(\\:\\d+)?(\\/[-a-z\\d%_.~+]*)*(\\?[;&a-z\\d%_.~+=-]*)?(\\#[-a-z\\d_]*)?$', 'i');        
        if (!urlRegex.test(url)){
            alert('Invalid Url');
            return;
        }

        if (port.length) {
            var portRegex = new RegExp('^(?:[0-9]+$)')
            if (!portRegex.test(port)) {
                alert('Invalid Port');
                return;
            }
        }
        

        var networkList = loadCustomNetwork(network);
    
        networkList.push({nodeName: nodeName, url: url, port: port});

        window.localStorage.setItem(network, JSON.stringify(networkList));
        loadNetwork();
        $('#addnode').modal('hide');
    })

    loadNetwork();
});

function checkNetwork() {
    var n = getParam('n');
    
    if (!$.isEmptyObject(n)){

        var _networks = n.split(',');

        $.each(_networks, function (key, net) { 
            if (net == 'mainnet')
                $("#ethnetworkall").trigger('click');
            else if (net == 'testnet')
                $("#testnetworkall").trigger('click');
            else
                $('#chk' + net + '').trigger('click');  
        });
        
    } else {
        $("#ethnetworkall").trigger('click');
    }

}

$(window).bind("load", function() {        
    positionFooter();    
    $(window)
            .scroll(positionFooter)
            .resize(positionFooter)
            
});

function positionFooter() {

    var footerHeight = 0,
    footerTop = 0,
    $footer = $("footer");
    
    footerHeight = $footer.height();
    footerTop = ($(window).scrollTop()+$(window).height()-footerHeight)+"px";

   if ( ($(document.body).height()+footerHeight) < $(window).height() - 80 ) {
       $footer.css({
            position: "absolute"
       })
   } else {
       $footer.css({
            position: "static"
       })
   }  
}

function loadNetwork(){

    var mainnet = getMainnetNetwork();
    var customMainnnet = loadCustomNetwork('mainnet');
    var testnet = getTestnetNetwork();
    var customTestnet  = loadCustomNetwork('testnet');
 
    $('ul.ulmainnet > li').not(':first').remove();

    $.each(mainnet, function(k, v){
        
        if (v.nodeName){
            $('<li />', {html: ' <input type="checkbox" id="chk'+ v.id + '" class="ethnetwork" name="' + v.nodeName +'"> ' + v.nodeName , class:'list-group-item'}).appendTo('ul.ulmainnet');
        }
    });

    $.each(customMainnnet, function(k,v){
        if (v.nodeName){
            $('<li />', {html: ' <input type="checkbox" id="chk'+ v.nodeName + '" class="ethnetwork" name="' + v.nodeName +'"> ' + v.nodeName  + '<a href="#" title="Remove Custom Node" onclick="removeNetwork(\'mainnet\', \'' + v.nodeName + '\')" style="float:right;color:#f80000"><i class="fa fa-minus"></i></a>', class:'list-group-item'}).appendTo('ul.ulmainnet');
        }
    });

    $('ul.ultestnet > li').not(':first').remove();

    $.each(testnet, function(k, v){
        
        if (v.nodeName){
            $('<li />', {html: ' <input type="checkbox" id="chk'+ v.id + '" class="testnetwork" name="' + v.nodeName +'"> ' + v.nodeName , class:'list-group-item'}).appendTo('ul.ultestnet');
        }
    });

    $.each(customTestnet, function(k,v){
      
        if (v.nodeName){
            $('<li />', {html: ' <input type="checkbox" id="chk'+ v.nodeName + '" class="testnetwork" name="' + v.nodeName +'"> ' + v.nodeName  + '<a href="#" title="Remove Custom Node" onclick="removeNetwork(\'testnet\', \'' + v.nodeName + '\')" style="float:right;color:#f80000"><i class="fa fa-minus"></i></a>', class:'list-group-item'}).appendTo('ul.ultestnet');
        }
    });


    
}

function removeNetwork(network, nodeName){

    var networkList = loadCustomNetwork(network);

    networkList.splice($.inArray(nodeName, networkList), 1);

    window.localStorage.setItem(network, JSON.stringify(networkList));

    loadNetwork();
}


function loadCustomNetwork(network){
    var networkList = [];   
        
    if (window.localStorage.getItem(network))
        networkList = JSON.parse(window.localStorage.getItem(network));

    return networkList
    
}

function getMainnetNetwork(){
    var networkList = [
        {
           id: 'infura', nodeName: 'infura', url: 'https://mainnet.infura.io/v3/a45f7ab372124312b0c1c2c93abd21cf', port: ''
        },
        {
            id: 'myetherwallet', nodeName: 'myetherwallet', url: 'https://api.myetherwallet.com/eth', port: ''
        },
        {
            id: 'mycrypto', nodeName: 'mycrypto', url: 'https://api.mycryptoapi.com/eth', port: ''
        }
    ];

    return networkList;
}

function getTestnetNetwork() {
    var networkList = [
        {
            id: 'ropsten_infura',nodeName: 'ropsten (infura)', url: 'https://ropsten.infura.io/v3/a45f7ab372124312b0c1c2c93abd21cf', port: ''
        },
        {
            id: 'kovan_infura',nodeName: 'kovan (infura)', url: 'https://kovan.infura.io/v3/a45f7ab372124312b0c1c2c93abd21cf', port: ''
        },
        {
            id: 'rinkeby_infura', nodeName: 'rinkeby (infura)', url: 'https://rinkeby.infura.io/v3/a45f7ab372124312b0c1c2c93abd21cf', port: ''
        },
        {
            id: 'goerli_infura', nodeName: 'goerli (infura)', url: 'https://goerli.infura.io/v3/a45f7ab372124312b0c1c2c93abd21cf', port: ''
        }
    ];

    return networkList;
}

function unique(array){
    return $.grep(array,function(el,index){
        return index == $.inArray(el,array);
    });
}

function getParam(name)
{
  name = name.replace(/[\[]/,"\\\[").replace(/[\]]/,"\\\]");
  var regexS = "[\\?&]"+name+"=([^&#]*)";
  var regex = new RegExp(regexS);
  var results = regex.exec(window.location.href);
  if( results == null )
    return "";
  else
    return decodeURIComponent(results[1].replace(/\+/g, " "));
}

function getSelectedMainnet() {
    var selected = [];
    $('.ethnetwork:checked').each(function() {
        selected.push($(this).attr('name'));
    });

    return selected;
}


function getSelectedTestnet() {
    var selected = [];
    $('.testnetwork:checked').each(function() {
        selected.push($(this).attr('name'));
    });

    return selected;
}

//conversion
function convertHex2Addr(hex) {
    var value = hex.substr(hex.length - 40);
    return '0x' + value;
}

function convertHex2a(hexx){
    var hex = hexx.toString();//force conversion
    var str = '';
    for (var i = 0; (i < hex.length && hex.substr(i, 2) !== '00'); i += 2)
        str += String.fromCharCode(parseInt(hex.substr(i, 2), 16));
    return str;
}

function convertDecimals(decimal, value){
	switch(decimal) {
		case 0:
			value = value;
			break;
		case 1:
			value = value.times(new BigNumber(0.1));
			break;
		case 2:
			value = value.times(new BigNumber(0.01));
			break;
		case 3:
			value = value.times(new BigNumber(0.001));
			break;
		case 4:
			value = value.times(new BigNumber(0.0001));
			break;
		case 5:
			value = value.times(new BigNumber(0.00001));
			break;
		case 6:
			value = value.times(new BigNumber(0.000001));
			break;
		case 7:
			value = value.times(new BigNumber(0.0000001));
			break;
		case 8:
			value = value.times(new BigNumber(0.00000001));
			break;
		case 9:
			value = value.times(new BigNumber(0.000000001));
			break;
		case 10:
			value = value.times(new BigNumber(0.0000000001));
			break;
		case 11:
			value = value.times(new BigNumber(0.00000000001));
			break;
		case 12:
			value = value.times(new BigNumber(0.000000000001));
			break;
		case 13:
			value = value.times(new BigNumber(0.0000000000001));
			break;
		case 14:
			value = value.times(new BigNumber(0.00000000000001));
			break;
		case 15:
			value = value.times(new BigNumber(0.000000000000001));
			break;
		case 16:
			value = value.times(new BigNumber(0.0000000000000001));
			break;
		case 17:
			value = value.times(new BigNumber(0.00000000000000001));
			break;
		case 18:
			value = value.times(new BigNumber(0.000000000000000001));
			break;
		default:
			value = value;
			break;
	}
	return value;
}

function validateHash(len, hash){
    
    var _regex = '0x([A-Fa-f0-9]{' +  len + '})';
    var regex = new RegExp(_regex);

    if (regex.test(hash))
        return true;
    else
        return false;
}

//ether conversion
function getWeiValue(number){    
    var value = new BigNumber(String(number)).times(1);
    return value.toString(10);
}

function getGweiValue(number){
    var value = new BigNumber(getWeiValue(number)).div(1000000000);
    return value.toString(10);
}

function getEtherValue(number) {
    var value = new BigNumber(getWeiValue(number)).div(1000000000000000000);
    return value.toString(10);
}


//
function getCustomABI() {
    return [{"constant":true,"inputs":[],"name":"name","outputs":[{"name":"","type":"string"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"_spender","type":"address"},{"name":"_value","type":"uint256"}],"name":"approve","outputs":[{"name":"","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[],"name":"totalSupply","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"_from","type":"address"},{"name":"_to","type":"address"},{"name":"_value","type":"uint256"}],"name":"transferFrom","outputs":[{"name":"","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[],"name":"decimals","outputs":[{"name":"","type":"uint8"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"name":"_owner","type":"address"}],"name":"balanceOf","outputs":[{"name":"balance","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"symbol","outputs":[{"name":"","type":"string"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"_to","type":"address"},{"name":"_value","type":"uint256"}],"name":"transfer","outputs":[{"name":"","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[{"name":"_owner","type":"address"},{"name":"_spender","type":"address"}],"name":"allowance","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"payable":true,"stateMutability":"payable","type":"fallback"},{"anonymous":false,"inputs":[{"indexed":true,"name":"owner","type":"address"},{"indexed":true,"name":"spender","type":"address"},{"indexed":false,"name":"value","type":"uint256"}],"name":"Approval","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"name":"from","type":"address"},{"indexed":true,"name":"to","type":"address"},{"indexed":false,"name":"value","type":"uint256"}],"name":"Transfer","type":"event"}];
}

function generateTxErr(err, network) {
  
    var lbl = '<div class="card text-white bg-danger mt-3"><div class="card-body"><h5 class="card-title">' + network + '</h5>' 
        lbl += '<div class="row mb-1"><div class="col-md-12"><h6> Error : ' + err + '</h6> <button class="btn btn-default btn-sm btn-go">Try Again</button></div></div>';

    $('.data-info').append(lbl);
        
}
