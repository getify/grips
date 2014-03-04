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

	function parentSelector() {
		return parent_selector.length > 0 ?
			parent_selector[parent_selector.length - 1] + " " :
			""
		;
	}

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
		var ret = "/*";

		if (node.children[0].token.type === _Grips_CSS.tokenizer.SLCOMMENT_START) {
			ret += "//";
		}
		ret += node.children[0].token.val + "*/";
		return ret;
	}

	function selector(node) {
		function param(node) {
			var varname = "", varvalue = "", k;
			for (k=0; k<node.children.length; k++) {
				if (node.children[k].type === _Grips_CSS.parser.OPERATOR &&
					node.children[k].token.type === _Grips_CSS.tokenizer.COLON
				) {
					break;
				}
				else if (!(
					node.children[k].type === _Grips_CSS.parser.WHITESPACE ||
					node.children[k].type === _Grips_CSS.parser.COMMENT
				)) {
					varname += node.children[k].token.val;
				}
			}
			for (k=k+1; k<node.children.length; k++) {
				if (!(
					node.children[k].type === _Grips_CSS.parser.WHITESPACE ||
					node.children[k].type === _Grips_CSS.parser.COMMENT
				)) {
					if (node.children[k].type === _Grips_CSS.parser.STRING_LITERAL) {
						varvalue += "\"" + node.children[k].val + "\"";
					}
					else {
						varvalue += node.children[k].token.val;
					}
				}
			}

			return varname + " = " + varname + " ? " + varname + " : " + varvalue;
		}

		var sel_text = "", param_list = "", id, i, j;

		for (i=0; i<node.children.length; i++) {
			if (node.children[i].type === _Grips_CSS.parser.TEXT ||
				node.children[i].type === _Grips_CSS.parser.WHITESPACE ||
				node.children[i].type === _Grips_CSS.parser.OPERATOR
			) {
				sel_text += node.children[i].token.val;
			}
			else if (node.children[i].type === _Grips_CSS.parser.STRING_LITERAL) {
				sel_text += node.children[i].delimiter + node.children[i].val + node.children[i].delimiter;
			}
			else if (node.children[i].type === _Grips_CSS.parser.PARAM_LIST) {
				for (j=0; j<node.children[i].children.length; j++) {
					if (node.children[i].children[j].type === _Grips_CSS.parser.PARAM) {
						param_list += " | " + param(node.children[i].children[j]);
					}
				}
			}
		}

		sel_text = parentSelector() + _Grips_CSS.trim(sel_text);
		parent_selector.push(sel_text);
		id = _Grips_CSS.encodeSelector(sel_text);

		render_all_collection += "{$= @\"" + id + "\" $}\n";

		return "{$: \"" + id + "\" }" +
			sel_text + " {{$= @\"" + id + "_\" $}}\n" +
			"{$: \"" + id + "_\"" + param_list + " }";
	}

	function rulesBody(node) {
		var rules_body = "";

		return "{" + rules_body + "}{$}\n";
	}

	function process(initialize) {
		var node, next_idx = 0, i, nodes = [], file = "", code = "", tmp, tmp2;

		while ((node = _Grips_CSS.parser.parseNextNode())) {
			nodes.push(node);

			for (i=next_idx; i<nodes.length && nodes[i].complete; i++, next_idx++) {
				node = nodes[i];

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
				else if (node.type === _Grips_CSS.parser.TEXT ||
					node.type === _Grips_CSS.parser.WHITESPACE
				) {
					render_all_collection += node.token.val;
				}
				else if (node.type === _Grips_CSS.parser.IMPORT_DIRECTIVE) {
					tmp = importDirective(node);
					file += tmp;
					code += tmp;
				}
				else if (node.type === _Grips_CSS.parser.COMMENT) {
					tmp = comment(node);
					render_all_collection += tmp;
				}
				else if (node.type === _Grips_CSS.parser.SELECTOR) {
					tmp = selector(node);
					file += tmp;
					code += tmp;
				}
				else if (node.type === _Grips_CSS.parser.RULES_BODY) {
					tmp = rulesBody(node);
					file += tmp;
					code += tmp;
				}
				else {
					//throw /* START_DEBUG */new _Grips.parser.ParserError("Unexpected text outside of tag",node) ||/* STOP_DEBUG */unknown_error;
				}
			}
		}

		return code;
	}

	var unknown_error = new Error("Unknown error"),
		render_all_collection = "",	parent_selector = []
	;

	_Grips_CSS.generator = {
		process: process
	};

})(this,this.grips,this.grips.css);
/* STOP_COMPILER */
