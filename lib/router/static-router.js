var mime = require('mime'),
    path = require('path'),
    fs = require('fs');

module.exports = staticRouter;

var MAX_FILES_IN_FLIGHT = 100;
var activeCount = 0;
var pending = [];

function staticRouter(root){

  root = path.join(root);

  function getFileHandler(request, response, next, cb) {
    return function() {
      activeCount++;
      var url = request.pathname === '/' ? '/index.html' : request.pathname;
      var filePath = path.join(root, url);
      fs.stat(filePath, function(err, stat){
        if (err || !stat.isFile()) {
          next();
          activeCount--;
          cb(err ? err : 'not a file', filePath);
        } else {
          response.headers.setHeader('Last-Modified', stat.mtime.toUTCString());
          var mimetype = mime.lookup(filePath);
          fs.readFile(filePath, function(err, buffer){
            if (err) {
              // console.log('appjs static router, error reading file - ' + filePath + ', err - ' + err);
              response.send(500);
              activeCount--;
              cb(err, filePath);
            } else {
              response.send(200,mimetype,buffer);
              activeCount--;
              cb(null, filePath);
            }
          });
        }
      });
    };
  }

  return function router(request, response, next){
    function fileHandlerCallback(err, filePath) {
      // console.log('appjs static router, finished processing request!');
      if ((activeCount < MAX_FILES_IN_FLIGHT) && pending.length) {
        pending.shift()();
      }
    }
    if (request.method === 'get') {
      if (activeCount < MAX_FILES_IN_FLIGHT) {
        getFileHandler(request, 
                       response, 
                       next,
                       fileHandlerCallback)();
      }
      else {
        pending.push(
          getFileHandler(request, 
                         response, 
                         next,
                         fileHandlerCallback));
      }
    } else {
      next();
    }
  };
}
