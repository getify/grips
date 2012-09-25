var grips, debug, path = require("path");

exports.__defineGetter__("grips",function(){
	if (!grips) grips = require(path.join(__dirname,"node-grips.js")).grips;
	return grips;
});

exports.__defineGetter__("debug",function(){
	if (!debug) debug = require(path.join(__dirname,"node-grips-debug.js")).grips;
	return debug;
});
