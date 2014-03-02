/* grips-css (c) 2012-2014 Kyle Simpson | http://getify.mit-license.org/ */

/* START_COMPILER */
(function __grips_css_generator__(global,_Grips,_Grips_CSS){

	// From: https://gist.github.com/3667624
	function escapeDoubleQuotes(str) {
		return str.replace(/\\([\s\S])|(")/g,"\\$1$2"); // thanks @slevithan!
	}

	function escapeNewlines(str) {
		return str.replace(/\n/g,"\\n").replace(/\r/g,"\\r");
	}

	function escapeEscapes(str) {
		return str.replace(/\\(?!\\*\")/g,"\\\\");
	}

/* START_DEBUG */
	function identifierify(str) {
		str = str.replace(/[^a-z0-9_$]/ig,"_");
		return str;
	}
/* STOP_DEBUG */

	function importDirective(node) {
		var id = "";
		if (node.children[0].type === _Grips_CSS.parser.TEXT) {
			id = node.children[0].token.val;
		}
		else if (node.children[0].type === _Grips_CSS.parser.STRING_LITERAL) {
			id = node.children[0].val;
		}
		render_all_collection += "{$= @\"" + id + "#all\" $}\n";
		return "{$+ \"" + id + "\" $}\n";
	}

	function comment(node) {
		return "/*" + node.children[0].token.val + "*/";
	}

	function children(node) {
	}

	function process(initialize) {
		var node, nodes = [], file = "", code = "", tmp, tmp2;

		while ((node = _Grips_CSS.parser.parseNextNode())) {
			nodes.push(node);

			if (node.type === _Grips_CSS.parser.FILE_MARKER) {
				if (node.start) {
					render_all_collection = "\n{$: \"#all\" }";
				}
				else if (node.close) {
					tmp = render_all_collection + "{$}\n";
					file += tmp;
					code += tmp;
					render_all_collection = "";
				}
			}
			else if (node.type === _Grips_CSS.parser.TEXT) {
				render_all_collection += node.token.val;
			}
			else if (node.type === _Grips_CSS.parser.WHITESPACE) {
				render_all_collection += node.token.val;
			}
			else if (node.type === _Grips_CSS.parser.IMPORT_DIRECTIVE) {
				tmp = importDirective(node);
				file += tmp;
				code += tmp;
			}
			else if (node.type === _Grips_CSS.parser.COMMENT) {
				render_all_collection += comment(node);
			}
			else {
				//throw /* START_DEBUG */new _Grips.parser.ParserError("Unexpected text outside of tag",node) ||/* STOP_DEBUG */unknown_error;
			}
		}

		return code;
	}

	var unknown_error = new Error("Unknown error"),
		render_all_collection = ""
	;

	_Grips_CSS.generator = {
		process: process
	};

})(this,this.grips,this.grips.css);
/* STOP_COMPILER */
