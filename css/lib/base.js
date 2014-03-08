/* grips-css (c) 2012-2014 Kyle Simpson | http://getify.mit-license.org/ */

(function __grips_css_base__(global){
	var old_grips_css = global.grips.css;

	function createSandbox() {

		function noConflict() {
			var new_grips_css = global.grips.css;
			global.grips.css = old_grips.css;
			return new_grips_css;
		}

		function trim(str) {
			return str.trim ? str.trim() : str.replace(/^\s+/,"").replace(/\s+$/,"");
		}

		function encodeSelector(selector) {
			return _Grips_CSS.btoa(
				unescape(
					encodeURIComponent(
						trim(selector)
					)
				)
			);
		}

		function decodeSelector(b64) {
			return decodeURIComponent(
				escape(
					_Grips_CSS.atob(selector)
				)
			);
		}

/* START_COMPILER */
		function compile(sources,initialize) {
			var ret = "", i, file_id;

			// default `initialize` to `true`
			initialize = (initialize !== false);

			if (Array.isArray(sources)) {
				for (i=0; i<sources.length; i++) {
					ret += compileFile(sources[i],null,initialize);
				}
			}
			else if (typeof sources === "object") {
				for (file_id in sources) { if (sources.hasOwnProperty(file_id)) {
					ret += compileFile(sources[file_id],file_id,initialize);
				}}
			}

			return ret;
		}

		function compileChunk(source,fileID) {
			if (!fileID) {
				throw /* START_DEBUG */new TemplateError("Missing file ID") ||/* STOP_DEBUG */unknown_error;
			}
			return compileFile(source,fileID,/*initialize=*/false);
		}

		function compileFile(source,fileID,initialize) {
/* START_DEBUG */
			var _err;
/* STOP_DEBUG */

			// default `initialize` to `true`
			initialize = (initialize !== false);

			try {
				if (_Grips_CSS.tokenizer.process(source,fileID)) {
					_Grips_CSS.parser.end(); // end the file stream
					return _Grips_CSS.generator.process(initialize);
				}
			}
			catch (err) {
/* START_DEBUG */
				if (err instanceof _Grips.tokenizer.TokenizerError ||
					err instanceof _Grips.parser.ParserError
				) {
					throw err;
				}
				else {
					_err = _Grips.error(fileID,null,"Unexpected compilation error",err);
					_err.stack = err.stack; // try to preserve the original error call stack, if possible
					throw _err;
				}
/* STOP_DEBUG */
				throw unknown_error;
			}
			return false;
		}

		function initialize(source) {
		}

		function initializeFile(fileID,source) {
			initialize(source);
		}
/* STOP_COMPILER */

		function render(id,$,$$) {
			// default empty render?
			if (!id) return "";

			var ret;

			if (ret !== false) {
				return ret;
			}
			else {
				throw /* START_DEBUG */new _Grips.TemplateError("[" + id + "] Template not found") ||/* STOP_DEBUG */unknown_error;
			}
		}


		var _Grips = global.grips, _Grips_CSS, files = {},
			unknown_error = new Error("Unknown error")
		;

		_Grips_CSS = {

/* START_COMPILER */
			compile: compile,
			compileChunk: compileChunk,
			compileFile: compileFile,

			initialize: initialize,
			initializeFile: initializeFile,
/* STOP_COMPILER */

			render: render,

			noConflict: noConflict,
			sandbox: createSandbox,
			trim: trim,
			encodeSelector: encodeSelector,
			decodeSelector: decodeSelector
		};

		if (global && global.atob) {
			_Grips_CSS.atob = global.atob.bind(global);
			_Grips_CSS.btoa = global.btoa.bind(global);
		}
		else if (typeof require !== "undefined") {
			_Grips_CSS.atob = require("atob");
			_Grips_CSS.btoa = require("btoa");
		}

		return _Grips_CSS;
	}

	global.grips.css = createSandbox();

})(this);
