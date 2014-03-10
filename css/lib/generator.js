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

	function stringLiteral(node) {
		return node.delimiter + node.val + node.delimiter;
	}

	function simpleValue(node) {
		if (node.type === _Grips_CSS.parser.TEXT ||
			node.type === _Grips_CSS.parser.WHITESPACE ||
			node.type === _Grips_CSS.parser.OPERATOR
		) {
			return node.token.val;
		}
		else if (node.type === _Grips_CSS.parser.STRING_LITERAL) {
			return stringLiteral(node);
		}
		else if (node.type === _Grips_CSS.parser.COMMENT) {
			return comment(node);
		}
	}

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
				else if (node.children[k].type === _Grips_CSS.parser.VARIABLE) {
					varvalue += variableReference(node.children[k]);
				}
				else {
					varvalue += "\"" + node.children[k].token.val + "\"";
				}
			}
		}

		return [varname,varvalue];
	}

	function selector(node) {

		function paramStr(node) {
			var param_parts = param(node);
			return param_parts[0] + " = " + param_parts[0] + " ? " + param_parts[0] + " : " + param_parts[1];
		}

		var sel_text = "", param_list = "", tmp, id, i, j;

		for (i=0; i<node.children.length; i++) {
			if (tmp = simpleValue(node.children[i])) {
				sel_text += tmp;
			}
			else if (node.children[i].type === _Grips_CSS.parser.PARAM_LIST) {
				for (j=0; j<node.children[i].children.length; j++) {
					if (node.children[i].children[j].type === _Grips_CSS.parser.PARAM) {
						param_list += " | " + paramStr(node.children[i].children[j]);
					}
				}
			}
		}

		sel_text = parentSelector() + _Grips_CSS.trim(sel_text);
		parent_selector.push(sel_text);
		id = _Grips_CSS.encodeSelector(sel_text);

		render_all_collection += "{$= @\"#" + id + "\" $}\n";

		return "{$: \"#" + id + "\" }" +
			sel_text + " {{$= @\"#" + id + "_\" $}}{$}\n" +
			"{$: \"#" + id + "_\"" + param_list + " }";
	}

	function variableReference(node) {
		var ref_str = "", tmp, i;

		for (i=0; i<node.children.length; i++) {
			if (tmp = simpleValue(node.children[i])) {
				ref_str += tmp;
			}
		}

		return ref_str;
	}

	function ruleProperty(node) {
		var prop_str = "", tmp, i;

		for (i=0; i<node.children.length; i++) {
			if (tmp = simpleValue(node.children[i])) {
				prop_str += tmp;
			}
		}

		return prop_str;
	}

	function ruleValue(node) {
		var val_str = "", tmp, i;

		for (i=0; i<node.children.length; i++) {
			if (tmp = simpleValue(node.children[i])) {
				val_str += tmp;
			}
			else if (node.children[i].type === _Grips_CSS.parser.VARIABLE) {
				val_str += "{$= " + variableReference(node.children[i]) + " $}";
			}
			else if (node.children[i].type === _Grips_CSS.parser.PREFIX_INCLUDE) {
				val_str += "{$= __vprfx__ $}";
			}
		}

		return val_str;
	}

	function prefixExpander(node) {
		var ex_str = "";

		ex_str += "{$* $.__prefixes__ | __vprfx__ = vendor_prefix ? vendor_prefix : _.value | $.__newline = _.last ? \"\" : \"\\n\" }";
		ex_str += "{$= __vprfx__ $}" + ruleProperty(node.children[0]) + ":" + ruleValue(node.children[1]) + ";{$= $.__newline $}";
		ex_str += "{$}";

		return ex_str;
	}

	function rulesBody(node) {
		var rules_body = "", post_rules_body = "", tmp, i;

		for (i=0; i<node.children.length; i++) {
			if (tmp = simpleValue(node.children[i])) {
				rules_body += tmp;
			}
			else if (node.children[i].type === _Grips_CSS.parser.SELECTOR) {
				tmp = selector(node.children[i]);
				post_rules_body += tmp;
			}
			else if (node.children[i].type === _Grips_CSS.parser.RULES_BODY) {
				tmp = rulesBody(node.children[i]);
				post_rules_body += tmp;
			}
			else if (node.children[i].type === _Grips_CSS.parser.INCLUDE_REF) {
				tmp = includeReference(node.children[i]);
				rules_body += tmp;
			}
			else if (node.children[i].type === _Grips_CSS.parser.RULE_PROPERTY) {
				tmp = ruleProperty(node.children[i]);
				rules_body += tmp;
			}
			else if (node.children[i].type === _Grips_CSS.parser.RULE_VALUE) {
				tmp = ruleValue(node.children[i]);
				rules_body += ":" + tmp + ";";
			}
			else if (node.children[i].type === _Grips_CSS.parser.PREFIX_EXPANDER) {
				tmp = prefixExpander(node.children[i]);
				rules_body += tmp;
			}
			else {
				throw /* START_DEBUG */new _Grips.parser.ParserError("Unexpected",node.children[i]) ||/* STOP_DEBUG */unknown_error;
			}
		}

		parent_selector.pop();

		return rules_body + "{$}\n" + (post_rules_body !== "" ? post_rules_body + "\n" : "");
	}

	function includeReference(node) {

		function paramStr(node) {
			var param_parts = param(node);
			return param_parts[0] + " = " + param_parts[1];
		}

		var sel_text = "", param_list = "", tmp, id, i, j;

		for (i=0; i<node.children.length; i++) {
			if (tmp = simpleValue(node.children[i])) {
				sel_text += tmp;
			}
			else if (node.children[i].type === _Grips_CSS.parser.SET_PARAMS) {
				for (j=0; j<node.children[i].children.length; j++) {
					if (node.children[i].children[j].type === _Grips_CSS.parser.PARAM) {
						param_list += (param_list !== "" ? " | " : "") + paramStr(node.children[i].children[j]);
					}
				}
			}
		}

		sel_text = _Grips_CSS.trim(sel_text);
		id = _Grips_CSS.encodeSelector(sel_text);

		return "{$# " + param_list + " }{$= @\"#" + id + "_\" $}{$}";
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
				else if (tmp = simpleValue(node)) {
					render_all_collection += tmp;
				}
				else if (node.type === _Grips_CSS.parser.IMPORT_DIRECTIVE) {
					tmp = importDirective(node);
					file += tmp;
					code += tmp;
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
					throw /* START_DEBUG */new _Grips.parser.ParserError("Unexpected text outside of rules body",node) ||/* STOP_DEBUG */unknown_error;
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
