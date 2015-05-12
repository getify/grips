/* grips-css (c) 2012-2015 Kyle Simpson | http://getify.mit-license.org/ */
;

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



		function render(id,$,$$) {
			// default empty render?
			if (!id) return "";

			var ret;

			if (ret !== false) {
				return ret;
			}
			else {
				throw new _Grips.TemplateError("[" + id + "] Template not found") ||unknown_error;
			}
		}


		var _Grips = global.grips, _Grips_CSS, files = {},
			unknown_error = new Error("Unknown error")
		;

		_Grips_CSS = {



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
;


;


;


