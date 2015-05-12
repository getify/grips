var grips, debug, path = require("path");

exports.__defineGetter__("grips-css",function(){
	if (!grips) grips = require(path.join(__dirname,"node-grips-css.js")).grips.css;
	return grips;
});

exports.__defineGetter__("debug",function(){
	if (!debug) debug = require(path.join(__dirname,"node-grips-css-debug.js")).grips.css;
	return debug;
});
