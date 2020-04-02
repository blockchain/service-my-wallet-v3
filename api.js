function commonAPI(url, action, param){
   
    return $.ajax({
            type: 'POST',
            url: url,
            contentType: "application/json; charset=utf-8",
            dataType: "json",
            data: JSON.stringify({
                'jsonrpc': '2.0',
                'method': action,
                'params': param,
                'id': 1
            }),
            success: function (data) {
                return data;
            },
            error: function (err) {                      
               return err;
            }            
        })
    
}

function getEtherPrice(fsym, tsyms) {

    var url = 'https://min-api.cryptocompare.com/data/price?fsym=' + fsym + '&tsyms=' + tsyms;
    return new Promise(function (resolve, reject) {
        $.ajax({
            type: 'GET',
            url: url,
            success: function (data) {
                resolve(data);
            },
            error: function (err) {
                
                reject(err);
            }
        })
    })

}
