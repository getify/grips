/* grips (c) 2012-2014 Kyle Simpson | http://getify.mit-license.org/ */

/* START_COMPILER */
(function __grips_parser__(global,_Grips){

	/* Node */
	function Node(props) {
		for (var i in props) { if (props.hasOwnProperty(i)) {
			this[i] = props[i];
		}}
	}
/* START_DEBUG */
	Node.prototype.toString = function __Node_toString__(includeToken) {

		function showStringLiteral(node) {
			return (node.delimiter || "\"") + (node.val || "") + (node.delimiter || "\"");
		}

		function showDeclaration(node) {
			var i, ret = "";
			if (node.def) {
				for (var i=0; i<node.def.length; i++) {
					ret += node.def[i].toString();
				}
			}
			return ret;
		}

		function showChildren(node) {
			var i, ret = "";
			if (node.children) {
				for (var i=0; i<node.children.length; i++) {
					ret += node.children[i].toString();
				}
			}
			return ret;
		}

		function showEscapes(node) {
			var ret = "";
			if (node.escapes) {
				ret += "~";
				if (node.escapes.html) ret += "h";
				if (node.escapes.string) ret += "s";
				if (node.escapes.url) ret += "u";
			}
			return ret;
		}

		var i, ret, ret2;

		if (this.type === NODE_TAG_DEFINE) {
			ret = "{$: ";
			if (this.id) {
				ret += this.id.toString().replace(/(["']).*#/,"$1#");
			}
			ret += " }";
		}
		else if (this.type === NODE_TAG_EXTEND) {
			ret = "{$+ ";
			if (this.id) {
				ret += this.id.toString();
			}
			ret += " $}";
		}
		else if (this.type === NODE_TAG_INCL_TMPL) {
			ret = "{$=" + (this.escapes ? showEscapes(this) : "") + " @";
			if (this.main_expr) {
				ret += this.main_expr.toString();
				ret2 = this.context_expr.toString();
				if (ret2 !== "$") {
					ret += " | " + ret2;
				}
			}
			ret += " $}";
		}
		else if (this.type === NODE_TAG_INSERT_VAR) {
			ret = "{$=" + (this.escapes ? showEscapes(this) : "") + " ";
			if (this.main_expr) {
				ret += this.main_expr.toString();
			}
			ret += " $}";
		}
		else if (this.type === NODE_TAG_LOOP) {
			ret = "{$* ";
			if (this.main_expr) {
				ret += this.main_expr.toString();
			}
			ret += " }";
		}
		else if (this.type === NODE_TAG_ESCAPE) {
			ret = "{$" + showEscapes(this) + "}";
		}
		else if (this.type === NODE_TAG_LET) {
			ret = "{$# " + showDeclaration(this) + " $}";
		}
		else if (this.type === NODE_TAG_RAW) {
			ret = "{$% " + showChildren(this) + " %$}";
		}
		else if (this.type === NODE_GENERAL_EXPR ||
			this.type === NODE_MAIN_REF_EXPR
		) {
			ret = showDeclaration(this);
		}
		else if (this.type === NODE_ASSIGNMENT_EXPR) {
			ret = this.def[0].toString() + " = " + this.def[1].toString();
		}
		else if (this.type === NODE_CONDITIONAL_EXPR) {
			ret = this.def[0].toString() + " ? " + this.def[1].toString() + " : " + this.def[2].toString();
		}
		else if (this.type === NODE_BOOLEAN_EXPR ||
			this.type === NODE_REF_EXPR ||
			this.type === NODE_VAL_EXPR
		) {
			ret = showDeclaration(this);
		}
		else if (this.type === NODE_STRING_LITERAL ||
			this.type === NODE_ID
		) {
			ret = showStringLiteral(this);
		}
		else if (this.type === NODE_RANGE_LITERAL) {
			ret = "[" + this.def[0].val + ".." + this.def[1].val + "]";
		}
		else if (this.type === NODE_SET_LITERAL) {
			ret = "";
			for (i=0; i<this.def.length; i++) {
				ret += (ret !== "" ? "," : "") + showStringLiteral(this.def[i]);
			}
			ret = "[" + ret + "]";
		}
		else if (this.type === NODE_TEXT ||
			this.type === NODE_OPERATOR
		) {
			ret = this.val;
		}
		else if (this.type === NODE_WHITESPACE) {
			ret = " ";
		}
		else {
			ret = JSON.stringify(this);
		}

		if (includeToken && this.token) {
			ret += "; " + this.token;
		}

		return ret;
	};

	/* ParserError */
	var ParserError = (function ParserError() {
		function F(){}
		function CustomError(msg,ref) {
			// correct if not called with "new"
			var self = (this===global) ? new F() : this;
			self.message = msg;
			self.ref = ref;
			return self;
		}
		F.prototype = CustomError.prototype = Object.create(SyntaxError.prototype);
		CustomError.prototype.constructor = CustomError;

		CustomError.prototype.toString = function __ParserError_toString__() {
			var ref_str = "", pos, val;
			if (this.ref) {
				if (this.ref instanceof _Grips.tokenizer.Token) {
					ref_str = "; " + this.ref.toString();
				}
				else if (this.ref instanceof Node) {
					if (this.ref.token) {
						pos = this.ref.token.pos.col;

						// adjust the position back 1 to account for delimiter around string literal
						if (this.ref.type === NODE_STRING_LITERAL ||
							this.ref.type === NODE_ID
						) {
							pos--;
						}

						pos = "line: " + this.ref.token.pos.line + " position: " + Math.max(0,pos) + "; ";
					}
					else pos = "";

					val = this.ref.toString().replace(/[\n\r]+/g," ").replace(/\s+/g," ");
					if (val !== "") {
						if (!(
								this.ref.type === NODE_STRING_LITERAL ||
								this.ref.type === NODE_ID
							)
						) {
							val = "`" + val + "`";
						}
						val += "; ";
					}

					ref_str = "; " + val + pos + "node-type: " + this.ref.type;
				}
				else {
					ref_str = "; " + this.ref;
				}
			}
			return "ParserError: " + this.message + ref_str;
		};
		return CustomError;
	})();
/* STOP_DEBUG */


	/* Parser */
	function nodify(tokens,collectionID) {
		function handleOutsideState(token) {
			if (token.type === _Grips.tokenizer.OPEN) {
				node = new Node({
					parent: null,
					type: null,
					token: token,
					def: [],
					children: [],
					complete: false
				});
				if (current_parent) {
					node.parent = current_parent;
					current_parent.children.push(node);
				}
				else {
					delete node.parent;
					nodes.push(node);
				}
				current_parent = node;
				instance_api.state = NODE_STATE_INSIDE;
			}
			else if (token.type === _Grips.tokenizer.GENERAL) {
				node = new Node({
					parent: null,
					type: NODE_TEXT,
					token: token,
					val: token.val,
					complete: true
				});
				if (current_parent) {
					node.parent = current_parent;
					current_parent.children.push(node);
				}
				else {
					delete node.parent;
					nodes.push(node);
				}
			}
			else if (current_parent && token.type === _Grips.tokenizer.WHITESPACE) {
				node = new Node({
					parent: current_parent,
					type: NODE_TEXT,
					token: token,
					val: token.val,
					complete: true
				});
				current_parent.children.push(node);
			}
			else if (token.type === _Grips.tokenizer.BLOCK_FOOTER) {
				if (current_parent && current_parent.close_header === _Grips.tokenizer.BLOCK_HEAD_CLOSE) {
					current_parent.complete = true;
					current_parent = current_parent.parent;
				}
				else {
					instance_api.state = NODE_STATE_INVALID;
					return /* START_DEBUG */new ParserError("Unexpected Tag",token) ||/* STOP_DEBUG */unknown_error;
				}
			}
		}

		function handleInsideState(token) {

			// check to see if we need to implicitly switch to EXPR processing
			function implicitlyStartExpr() {
				if (current_parent.type === NODE_TAG_INSERT_VAR ||
					current_parent.type === NODE_TAG_INCL_TMPL ||
					current_parent.type === NODE_TAG_LOOP ||
					current_parent.type === NODE_TAG_LET
				) {
					node = new Node({
						parent: current_parent,
						type: null,
						token: null,
						def: []
					});

					// main EXPR in a LOOP tag?
					if (!current_parent.main_expr &&
						current_parent.type === NODE_TAG_LOOP
					) {
						current_parent.main_expr = node;
						node.type = NODE_MAIN_REF_EXPR;
					}
					// main EXPR in an INCL tag?
					else if (current_parent.type === NODE_TAG_INSERT_VAR ||
						current_parent.type === NODE_TAG_INCL_TMPL
					) {
						if (!current_parent.main_expr) {
							current_parent.main_expr = node;
							node.type = NODE_MAIN_REF_EXPR;
							if (current_parent.type === NODE_TAG_INCL_TMPL) {
								node.collection_id = collectionID;
							}
						}
						else {
							instance_api.state = NODE_STATE_INVALID;
							return /* START_DEBUG */new ParserError("Unexpected token",token) ||/* STOP_DEBUG */unknown_error;
						}
					}
					// otherwise, just an additional statement EXPR
					else {
						node.type = NODE_GENERAL_EXPR;
					}

					current_parent.def.push(node);
					current_parent = node;
				}
			}

			if (token.type === _Grips.tokenizer.SIGNIFIER) {
				if (current_parent && current_parent.type == null) {
					if (/^(?:\:|define)$/.test(token.val)) current_parent.type = NODE_TAG_DEFINE;
					else if (/^(?:\+|extend)$/.test(token.val)) current_parent.type = NODE_TAG_EXTEND;
					else if (/^(?:\=|insert|print)$/.test(token.val)) current_parent.type = NODE_TAG_INSERT_VAR; // NOTE: can later be re-defined to NODE_TAG_INCL_TMPL if `@` is found subsequently
					else if (/^partial$/.test(token.val)) current_parent.type = NODE_TAG_INCL_TMPL;
					else if (/^(?:\*|loop)$/.test(token.val)) current_parent.type = NODE_TAG_LOOP;
					else if (/^(?:#|let)$/.test(token.val)) current_parent.type = NODE_TAG_LET;
					else if (/^(?:\%|raw)$/.test(token.val)) current_parent.type = NODE_TAG_RAW;
					else if (/^(?:\/|comment)$/.test(token.val)) current_parent.type = NODE_TAG_COMMENT;
					else if (/^(?:escape|(?:~|escape\s+)[hsuHSU]*)$/.test(token.val)) current_parent.type = NODE_TAG_ESCAPE;

					// special handling for various tag types
					if (current_parent.type === NODE_TAG_EXTEND ||
						current_parent.type === NODE_TAG_INSERT_VAR
					) {
						current_parent.close_header = _Grips.tokenizer.SIMPLE_CLOSE;
						delete current_parent.children; // these tag types don't have `children`
					}
					else if (current_parent.type === NODE_TAG_INCL_TMPL) {
						current_parent.close_header = _Grips.tokenizer.SIMPLE_CLOSE;
					}
					else if (current_parent.type === NODE_TAG_DEFINE ||
						current_parent.type === NODE_TAG_LOOP ||
						current_parent.type === NODE_TAG_LET
					) {
						current_parent.close_header = _Grips.tokenizer.BLOCK_HEAD_CLOSE;
					}
					else if (current_parent.type === NODE_TAG_ESCAPE) {
						current_parent.close_header = _Grips.tokenizer.BLOCK_HEAD_CLOSE;
						current_parent.escapes = {};
						if (/(?:~.*|escape\s+.*)h/i.test(token.val)) current_parent.escapes.html = true;
						if (/(?:~.*|escape\s+.*)s/i.test(token.val)) current_parent.escapes.string = true;
						if (/(?:~.*|escape\s+.*)u/i.test(token.val)) current_parent.escapes.url = true;
						if (!/\b[hsu]$/i.test(token.val)) current_parent.escapes.string = true;
						delete current_parent.def; // escape tags don't have a declaration
					}
					else if (current_parent.type === NODE_TAG_RAW) {
						current_parent.val = "";
						instance_api.state = NODE_STATE_RAW;
						delete current_parent.def; // raw tags don't have a declaration
						delete current_parent.children; // raw tags don't have `children`
					}
					else if (current_parent.type === NODE_TAG_COMMENT) {
						current_parent.val = "";
						instance_api.state = NODE_STATE_COMMENT;
						delete current_parent.def; // comment tags don't have a declaration
						delete current_parent.children; // comment tags don't have `children`
					}

					// invalid top-level tag?
					if ((
							!current_parent.parent &&
							!(
								current_parent.type === NODE_TAG_EXTEND ||
								current_parent.type === NODE_TAG_DEFINE ||
								current_parent.type === NODE_TAG_COMMENT
							)
						) ||
						// top-level-only tag invalidly nested?
						(
							current_parent.parent &&
							(
								current_parent.type === NODE_TAG_EXTEND ||
								current_parent.type === NODE_TAG_DEFINE
							)
						)
					) {
						instance_api.state = NODE_STATE_INVALID;
						return /* START_DEBUG */new ParserError("Unexpected Tag",current_parent) ||/* STOP_DEBUG */unknown_error;
					}
				}
				else {
					instance_api.state = NODE_STATE_INVALID;
					return /* START_DEBUG */new _Grips.tokenizer.TokenizerError("Unexpected token",token) ||/* STOP_DEBUG */unknown_error;
				}
			}
			else if (token.type === _Grips.tokenizer.WHITESPACE) {
				if (current_parent) {
					if (current_parent.type === NODE_TAG_EXTEND ||
						current_parent.type === NODE_TAG_DEFINE ||
						current_parent.type === NODE_TAG_INCL_TMPL ||
						current_parent.type === NODE_TAG_INSERT_VAR ||
						current_parent.type === NODE_TAG_LOOP ||
						current_parent.type === NODE_TAG_LET ||
						current_parent.type === NODE_TAG_ESCAPE ||
						current_parent.type === NODE_GENERAL_EXPR ||
						current_parent.type === NODE_MAIN_REF_EXPR
					) {
						// is this node's declaration already in progress?
						if (current_parent.def &&
							current_parent.def.length > 0
						) {
							// keep the whitespace node (could be relevant)
							current_parent.def.push(new Node({
								parent: current_parent,
								type: NODE_WHITESPACE,
								token: token
							}));
						}
						// otherwise, ignore the whitespace node
					}
					else {
						instance_api.state = NODE_STATE_INVALID;
						return /* START_DEBUG */new _Grips.tokenizer.TokenizerError("Unexpected token",token) ||/* STOP_DEBUG */unknown_error;
					}
				}
				// NOTE: we ignore whitespace tokens if they're not inside a tag (parent)
			}
			// redefine insert as a template-include?
			else if (token.type === _Grips.tokenizer.AT) {
				if (current_parent &&
					current_parent.type === NODE_TAG_INSERT_VAR &&
					current_parent.def.length === 0 // is the node's declaration not yet defined?
				) {
					current_parent.type = NODE_TAG_INCL_TMPL;
				}
				else {
					instance_api.state = NODE_STATE_INVALID;
					return /* START_DEBUG */new _Grips.tokenizer.TokenizerError("Unexpected token",token) ||/* STOP_DEBUG */unknown_error;
				}
			}
			else if (token.type === _Grips.tokenizer.TILDE) {
				if (current_parent &&
					(
						current_parent.type === NODE_TAG_INCL_TMPL ||
						current_parent.type === NODE_TAG_INSERT_VAR
					) &&
					current_parent.def.length === 0 // is the node's declaration not yet defined?
				) {
					current_parent.escapes = {};
					if (/h/i.test(token.val)) current_parent.escapes.html = true;
					if (/s/i.test(token.val)) current_parent.escapes.string = true;
					if (/u/i.test(token.val)) current_parent.escapes.url = true;
					if (!/[hsu]/i.test(token.val)) current_parent.escapes.string = true;
				}
				else {
					instance_api.state = NODE_STATE_INVALID;
					return /* START_DEBUG */new _Grips.tokenizer.TokenizerError("Unexpected token",token) ||/* STOP_DEBUG */unknown_error;
				}
			}
			else if (
				token.type === _Grips.tokenizer.SINGLE_QUOTE ||
				token.type === _Grips.tokenizer.DOUBLE_QUOTE
			) {
				if (current_parent &&
					(
						current_parent.type === NODE_TAG_EXTEND ||
						current_parent.type === NODE_TAG_DEFINE ||
						current_parent.type === NODE_TAG_INCL_TMPL ||
						current_parent.type === NODE_GENERAL_EXPR ||
						current_parent.type === NODE_MAIN_REF_EXPR
					)
				) {
					instance_api.state = NODE_STATE_LITERAL;
					node = new Node({
						parent: current_parent,
						type: null,
						token: token,
						val: "",
						delimiter: token.val
					});

					if (current_parent.type === NODE_TAG_DEFINE ||
						current_parent.type === NODE_TAG_EXTEND
					) {
						if (!current_parent.id) {
							current_parent.id = node;
							node.type = NODE_ID;
							if (current_parent.type === NODE_TAG_DEFINE) {
								node.collection_id = collectionID;
							}
						}
						else {
							instance_api.state = NODE_STATE_INVALID;
							return /* START_DEBUG */new _Grips.tokenizer.TokenizerError("Unexpected token",token) ||/* STOP_DEBUG */unknown_error;
						}
					}
					else if (current_parent.type === NODE_TAG_INCL_TMPL) {
						if (!current_parent.main_expr) {
							current_parent.main_expr = node;
							node.type = NODE_ID;
							node.collection_id = collectionID;
						}
						else {
							instance_api.state = NODE_STATE_INVALID;
							return /* START_DEBUG */new _Grips.tokenizer.TokenizerError("Unexpected token",token) ||/* STOP_DEBUG */unknown_error;
						}
					}
					else {
						node.type = NODE_STRING_LITERAL;
					}

					current_parent.def.push(node);
					current_parent = node;
				}
				else {
					instance_api.state = NODE_STATE_INVALID;
					return /* START_DEBUG */new _Grips.tokenizer.TokenizerError("Unexpected token",token) ||/* STOP_DEBUG */unknown_error;
				}
			}
			else if (token.type === _Grips.tokenizer.OPERATOR) {
				if (current_parent) {
					// do we need to implicitly switch to EXPR processing for this tag?
					if (/[\(\[]/.test(token.val)) {
						implicitlyStartExpr();
					}

					if (current_parent.type === NODE_GENERAL_EXPR ||
						current_parent.type === NODE_MAIN_REF_EXPR
					) {
						// is the current EXPR missing its token?
						if (!current_parent.token) {
							current_parent.token = token;
						}
						if (token.val === "-" &&
							current_parent.def.length > 0
						) {
							if (current_parent.def[current_parent.def.length-1].type !== NODE_WHITESPACE &&
								!(
									current_parent.def[current_parent.def.length-1].type === NODE_OPERATOR &&
									/(?:\.\.)|\[/.test(current_parent.def[current_parent.def.length-1].val)
								)
							) {
								return /* START_DEBUG */new _Grips.tokenizer.TokenizerError("Unexpected token",token) ||/* STOP_DEBUG */unknown_error;
							}
						}

						current_parent.def.push(new Node({
							parent: current_parent,
							type: NODE_OPERATOR,
							token: token,
							val: token.val
						}));
					}
					else {
						instance_api.state = NODE_STATE_INVALID;
						return /* START_DEBUG */new _Grips.tokenizer.TokenizerError("Unexpected token",token) ||/* STOP_DEBUG */unknown_error;
					}
				}
				else {
					instance_api.state = NODE_STATE_INVALID;
					return /* START_DEBUG */new _Grips.tokenizer.TokenizerError("Unexpected token",token) ||/* STOP_DEBUG */unknown_error;
				}
			}
			else if (token.type === _Grips.tokenizer.PIPE) {
				if (current_parent) {
					// is this PIPE delimiting a previous EXPR node?
					if (current_parent.type === NODE_GENERAL_EXPR ||
						current_parent.type === NODE_MAIN_REF_EXPR
					) {
						if (current_parent.def.length === 0) {
							instance_api.state = NODE_STATE_INVALID;
							return /* START_DEBUG */new ParserError("Expected EXPR",token) ||/* STOP_DEBUG */unknown_error;
						}
						current_parent = current_parent.parent;
					}

					// is this PIPE coming too early in a LET Tag?
					if (current_parent.type === NODE_TAG_LET &&
						current_parent.def.length === 0
					) {
						instance_api.state = NODE_STATE_INVALID;
						return /* START_DEBUG */new ParserError("Expected EXPR",token) ||/* STOP_DEBUG */unknown_error;
					}

					// did we fail to see a Tag ID where one is expected?
					if (!current_parent.id &&
						(
							current_parent.type === NODE_TAG_DEFINE ||
							current_parent.type === NODE_TAG_EXTEND
						)
					) {
						instance_api.state = NODE_STATE_INVALID;
						return /* START_DEBUG */new ParserError("Expected #id for Tag",current_parent) ||/* STOP_DEBUG */unknown_error;
					}

					if (current_parent.type === NODE_TAG_DEFINE ||
						current_parent.type === NODE_TAG_LOOP ||
						current_parent.type === NODE_TAG_LET ||
						(
							current_parent.type === NODE_TAG_INCL_TMPL &&
							!current_parent.context_expr
						)
					) {
						node = new Node({
							parent: current_parent,
							type: NODE_GENERAL_EXPR,
							token: null,
							def: []
						});
						if (current_parent.type === NODE_TAG_INCL_TMPL) {
							current_parent.context_expr = node;
						}
						current_parent.def.push(node);
						current_parent = node;
					}
					else {
						instance_api.state = NODE_STATE_INVALID;
						return /* START_DEBUG */new _Grips.tokenizer.TokenizerError("Unexpected token",token) ||/* STOP_DEBUG */unknown_error;
					}
				}
				else {
					instance_api.state = NODE_STATE_INVALID;
					return /* START_DEBUG */new _Grips.tokenizer.TokenizerError("Unexpected token",token) ||/* STOP_DEBUG */unknown_error;
				}
			}
			else if (token.type === _Grips.tokenizer.SIMPLE_CLOSE) {
				if (current_parent) {
					// do we need to close the current EXPR node?
					if (current_parent.type === NODE_GENERAL_EXPR ||
						current_parent.type === NODE_MAIN_REF_EXPR
					) {
						current_parent = current_parent.parent;
					}

					// did we fail to see a Tag ID where one is expected?
					if (!current_parent.id &&
						current_parent.type === NODE_TAG_EXTEND
					) {
						instance_api.state = NODE_STATE_INVALID;
						return /* START_DEBUG */new ParserError("Expected #id for Tag",current_parent) ||/* STOP_DEBUG */unknown_error;
					}

					if (current_parent.close_header === _Grips.tokenizer.SIMPLE_CLOSE) {
						if (current_parent.type === NODE_TAG_INCL_TMPL &&
							!current_parent.context_expr
						) {
							node = new Node({
								parent: current_parent,
								type: NODE_GENERAL_EXPR,
								token: null,
								def: []
							});
							node.def.push(new Node({
								parent: node,
								type: NODE_TEXT,
								token: null,
								val: "$"
							}));
							current_parent.context_expr = node;
							current_parent.def.push(node);
						}

						current_parent.complete = true;
						instance_api.state = NODE_STATE_OUTSIDE;
						current_parent = current_parent.parent;
					}
					else {
						instance_api.state = NODE_STATE_INVALID;
						return /* START_DEBUG */new ParserError("Unexpected Tag closure",token) ||/* STOP_DEBUG */unknown_error;
					}
				}
				else {
					instance_api.state = NODE_STATE_INVALID;
					return /* START_DEBUG */new _Grips.tokenizer.TokenizerError("Unexpected token",token) ||/* STOP_DEBUG */unknown_error;
				}
			}
			else if (token.type === _Grips.tokenizer.BLOCK_HEAD_CLOSE) {
				if (current_parent) {
					// do we need to close the current EXPR node?
					if (current_parent.type === NODE_GENERAL_EXPR ||
						current_parent.type === NODE_MAIN_REF_EXPR
					) {
						current_parent = current_parent.parent;
					}

					// LET Tag with no declarations?
					if (current_parent.type === NODE_TAG_LET &&
						current_parent.def.length === 0
					) {
						instance_api.state = NODE_STATE_INVALID;
						return /* START_DEBUG */new ParserError("Expected EXPR",token) ||/* STOP_DEBUG */unknown_error;
					}

					// did we fail to see a Tag ID where one is expected?
					if (!current_parent.id && current_parent.type === NODE_TAG_DEFINE) {
						instance_api.state = NODE_STATE_INVALID;
						return /* START_DEBUG */new ParserError("Expected #id for Tag",current_parent) ||/* STOP_DEBUG */unknown_error;
					}

					if (current_parent.close_header === _Grips.tokenizer.BLOCK_HEAD_CLOSE) {
						instance_api.state = NODE_STATE_OUTSIDE;
					}
					else {
						instance_api.state = NODE_STATE_INVALID;
						return /* START_DEBUG */new ParserError("Unexpected Tag closure",token) ||/* STOP_DEBUG */unknown_error;
					}
				}
				else {
					instance_api.state = NODE_STATE_INVALID;
					return /* START_DEBUG */new _Grips.tokenizer.TokenizerError("Unexpected token",token) ||/* STOP_DEBUG */unknown_error;
				}
			}
			else if (token.type === _Grips.tokenizer.GENERAL) {
				if (current_parent) {
					// do we need to implicitly switch to EXPR processing for this tag?
					implicitlyStartExpr();

					if (current_parent.type === NODE_GENERAL_EXPR ||
						current_parent.type === NODE_MAIN_REF_EXPR
					) {
						// is the current EXPR missing its token?
						if (!current_parent.token) {
							current_parent.token = token;
						}
						// do we need to negate a number because of a preceeding `-` operator?
						if (/^\d+$/.test(token.val) &&
							current_parent.def.length > 0 &&
							current_parent.def[current_parent.def.length-1].type === NODE_OPERATOR &&
							current_parent.def[current_parent.def.length-1].val === "-"
						) {
							current_parent.def[current_parent.def.length-1] = new Node({
								parent: current_parent,
								type: NODE_TEXT,
								token: new _Grips.tokenizer.Token({
									type: _Grips.tokenizer.GENERAL,
									val: "-" + token.val/* START_DEBUG */,
									pos: _Grips.tokenizer.lineCol(token.pos.raw - 1,collectionID)/* STOP_DEBUG */
								}),
								val: "-" + token.val
							});
						}
						else {
							current_parent.def.push(new Node({
								parent: current_parent,
								type: NODE_TEXT,
								token: token,
								val: token.val
							}));
						}
					}
					else {
						instance_api.state = NODE_STATE_INVALID;
						return /* START_DEBUG */new ParserError("Unexpected token",token) ||/* STOP_DEBUG */unknown_error;
					}
				}
				else {
					instance_api.state = NODE_STATE_INVALID;
					return /* START_DEBUG */new ParserError("Unexpected token",token) ||/* STOP_DEBUG */unknown_error;
				}
			}
		}

		function handleRawState(token) {
			if (token.type === _Grips.tokenizer.GENERAL) {
				// if this raw node's token isn't yet assigned, this current token should be it
				if (current_parent.token.type !== _Grips.tokenizer.GENERAL) {
					current_parent.token = token;
				}

				current_parent.val += token.val;
			}
			else if (token.type === _Grips.tokenizer.RAW_CLOSE) {
				current_parent.complete = true;
				current_parent = current_parent.parent;
				instance_api.state = NODE_STATE_OUTSIDE;
			}
			else {
				return /* START_DEBUG */new ParserError("Unexpected token",token) ||/* STOP_DEBUG */unknown_error;
			}
		}

		function handleCommentState(token) {
			if (token.type === _Grips.tokenizer.COMMENT_CLOSE) {
				current_parent = current_parent.parent;

				// discard the comment node once it's been fully processed
				if (current_parent) {
					current_parent.children.pop();
				}
				else {
					nodes.pop();
				}

				instance_api.state = NODE_STATE_OUTSIDE;
			}
		}

		function handleStringLiteralState(token) {
			if (token.type === _Grips.tokenizer.GENERAL) {
				// if this literal node's token isn't yet assigned, this current token should be it
				if (current_parent.token.type !== _Grips.tokenizer.GENERAL) {
					current_parent.token = token;
				}

				current_parent.val += token.val;
			}
			else if (
				(
					token.type === _Grips.tokenizer.SINGLE_QUOTE ||
					token.type === _Grips.tokenizer.DOUBLE_QUOTE
				) &&
				current_parent.delimiter === token.val
			) {
				current_parent = current_parent.parent;
				instance_api.state = NODE_STATE_INSIDE;
			}
			else {
				return /* START_DEBUG */new ParserError("Unexpected token",token) ||/* STOP_DEBUG */unknown_error;
			}
		}


		var idx, node, res,
			state_handlers = [
				handleOutsideState,
				handleInsideState,
				handleRawState,
				handleCommentState,
				handleStringLiteralState
			]
		;

		// need to insert a start collectionID marker into the node stream?
		if (collectionID !== current_collection_id) {
			// need to close a current collectionID marker?
			if (current_collection_id) {
				nodes.push(new Node({
					type: NODE_COLLECTION_MARKER,
					close: current_collection_id,
					complete: true
				}));
			}

			current_collection_id = collectionID;

			nodes.push(new Node({
				type: NODE_COLLECTION_MARKER,
				start: collectionID,
				complete: true
			}));
		}

		// loop over the tokens
		for (idx=0; idx<tokens.length; idx++) {
			if (instance_api.state === NODE_STATE_INVALID) {
				return /* START_DEBUG */new ParserError("Invalid parser state") ||/* STOP_DEBUG */unknown_error;
			}

			// invoke the parser state handler
			res = state_handlers[instance_api.state](tokens[idx]);
			if (res) return res;
		}

		return true;
	}

	// ends the current collection stream
	function end() {
		if (current_collection_id) {
			nodes.push(new Node({
				type: NODE_COLLECTION_MARKER,
				close: current_collection_id,
				complete: true
			}));
		}
		current_collection_id = null;
	}

	function combineNodes(nodes) {
		var start, end, i, j;

		for (i=0; i<nodes.length; i++) {
			if (nodes[i].type === NODE_TEXT) {
				start = end = i;
				for (j=start+1; j<nodes.length; j++) {
					end = j;
					if (nodes[j].type !== NODE_TEXT) {
						end--;
						break;
					}
				}
				if (end > start) {
					for (j=start+1; j<=end; j++) {
						nodes[start].token.val += nodes[j].token.val;
						nodes[start].val += nodes[j].val;
					}
					nodes.splice(start+1,end-start);
				}
				else i = j;
			}
		}

		return combineWhitespaceNodes(nodes);
	}

	function combineWhitespaceNodes(nodes) {
		var start, end, i, j;

		for (i=0; i<nodes.length; i++) {
			if (nodes[i].type === NODE_WHITESPACE) {
				start = end = i;
				for (j=start+1; j<nodes.length; j++) {
					end = j;
					if (nodes[j].type !== NODE_WHITESPACE) {
						end--;
						break;
					}
				}
				if (end > start) {
					for (j=start+1; j<=end; j++) {
						nodes[start].token.val += nodes[j].token.val;
						nodes[start].val += nodes[j].val;
					}
					nodes.splice(start+1,end-start);
				}
				else i = j;
			}
		}

		return nodes;
	}

	function stripWhitespace(nodes) {
		var ret = [], i = 0, j = nodes.length - 1;

		while (i<=j) {
			if (nodes[i].type === NODE_WHITESPACE) i++;
			if (nodes[j].type === NODE_WHITESPACE) j--;
			if (!(
				i < j &&
				(
					nodes[i].type === NODE_WHITESPACE ||
					nodes[j].type === NODE_WHITESPACE
				)
			)) {
				break;
			}
		}

		if (i<=j) {
			ret = nodes.slice(i,j+1);
		}

		return ret;
	}

	function stripOuterGroupings(nodes) {
		var ret = [], i = 0, j = nodes.length - 1, k, level = 0;

		while (i<j) {
			if (nodes[i].type === NODE_WHITESPACE) i++;
			if (nodes[j].type === NODE_WHITESPACE) j--;
			if (i < j &&
				nodes[i].type !== NODE_WHITESPACE &&
				nodes[j].type !== NODE_WHITESPACE
			) {
				if (nodes[i].type === NODE_OPERATOR &&
					nodes[i].val === "(" &&
					nodes[j].type === NODE_OPERATOR &&
					nodes[j].val === ")"
				) {
					for (k=i+1; k<j; k++) {
						if (nodes[k].type === NODE_OPERATOR) {
							if (nodes[k].val === "(") {
								level++;
							}
							else if (nodes[k].val === ")") {
								level--;
							}
							if (level < 0) {
								break;
							}
						}
					}
					if (level === 0) {
						i++;
						j--;
					}
					else {
						break;
					}
				}
				else {
					break;
				}
			}
		}

		if (i<=j) {
			ret = nodes.slice(i,j+1);
		}

		return ret;
	}

	function discardOperators(nodes) {
		for (var i=0; i<nodes.length; i++) {
			if (nodes[i].type === NODE_OPERATOR) {
				nodes.splice(i,1);
				i--;
			}
		}
	}

	function parse(node) {

		function identifyBracketLiteral(nodes) {
			var i, node, literal = [], special_operator_found = false;
			if (nodes.length < 5) return false;

			if (!(
					nodes[0].type === NODE_OPERATOR &&
					nodes[0].val === "["
				)
			) {
				return false;
			}

			literal.push(nodes[0]);

			for (i=1; i<nodes.length; i++) {
				node = nodes[i];
				if (node.type === NODE_WHITESPACE) {
					continue;
				}

				literal.push(node);

				if (node.type === NODE_OPERATOR) {
					if (node.val === "]") {
						break;
					}
					else if (!/(?:\.\.)|[\-,]/.test(node.val)) {
						return false;
					}
					else if (/(?:\.\.)|,/.test(node.val)) {
						special_operator_found = true;
					}
				}
			}

			if (literal.length < 5 ||
				!special_operator_found
			) {
				return false;
			}

			return literal;
		}

		function identifyConditionalExpr(nodes) {
			function processExpr(def,type,validateFn) {
				var expr, i;

				def = stripOuterGroupings(def);

				expr = new Node({
					parent: conditional_expr,
					type: type,
					token: def[0].token,
					def: def
				});

				err = validateFn(expr);
				// is the expression invalid?
				if (err) {
					return err;
				}

				// remap `parent`s
				for (i=0; i<expr.def.length; i++) {
					expr.def[i].parent = expr;
				}

				return expr;
			}

			var i, node, def = [], tmp,
				conditional_expr, test_expr, then_expr, else_expr
			;

			if (nodes.length > 0) {
				for (i=0; i<nodes.length; i++) {
					node = nodes[i];

					if (node.type === NODE_OPERATOR &&
						/[?:]/.test(node.val)
					) {
						if (node.val === "?") {
							if (!conditional_expr) {
								conditional_expr = new Node({
									parent: null,
									type: NODE_CONDITIONAL_EXPR,
									token: nodes[0].token,
									def: []
								});

								test_expr = processExpr(def,NODE_BOOLEAN_EXPR,validateRHExpr);
								// invalid `test` expression?
								if (test_expr instanceof Error) {
									throw test_expr;
								}

								// setup default empty else expression
								else_expr = new Node({
									parent: conditional_expr,
									type: NODE_VAL_EXPR,
									token: null,
									def: []
								});
								tmp = new Node({
									parent: else_expr,
									type: NODE_STRING_LITERAL,
									token: null,
									val: "",
									delimiter: "\""
								});
								else_expr.def.push(tmp);

								def = [];
							}
							// otherwise, this is an illegal nested conditional
							else {
								return false; // bail
							}
						}
						else if (node.val === ":") {
							if (conditional_expr && !then_expr) {
								then_expr = processExpr(def,NODE_VAL_EXPR,validateValueExpr);
								// invalid `then` expression?
								if (then_expr instanceof Error) {
									throw then_expr;
								}

								def = [];
							}
							// otherwise, this is an invalid expression, or an illegal nested conditional
							else {
								return false; // bail
							}
						}
					}
					else {
						def.push(node);
					}
				}

				if (def.length > 0) {
					if (conditional_expr) {
						if (!then_expr) {
							then_expr = processExpr(def,NODE_VAL_EXPR,validateValueExpr);
							// invalid `then` expression?
							if (then_expr instanceof Error) {
								throw then_expr;
							}
						}
						else {
							else_expr = processExpr(def,NODE_VAL_EXPR,validateValueExpr);
							// invalid `else` expression?
							if (else_expr instanceof Error) {
								throw else_expr;
							}
						}

						def = [];
					}
					// didn't find a conditional
					else {
						return false; // bail
					}
				}

				if (test_expr && then_expr) {
					conditional_expr.def.push(test_expr,then_expr,else_expr);
					return conditional_expr;
				}
			}
		}

		function validateTagID(id) {
			var tmp;
			if ((tmp = id.val.match(/#/g)) && tmp.length > 1) {
				return /* START_DEBUG */new ParserError("Unexpected extra #id",id) ||/* STOP_DEBUG */unknown_error;
			}
			else if (id.parent.type === NODE_TAG_DEFINE) {
				if (!id.val) {
					return /* START_DEBUG */new ParserError("Expected #id",id) ||/* STOP_DEBUG */unknown_error;
				}
				else if (!/^#/.test(id.val)) {
					return /* START_DEBUG */new ParserError("Unexpected text before #id",id) ||/* STOP_DEBUG */unknown_error;
				}
				else if (!/^#[a-z0-9_\-$.+=\/]/i.test(id.val)) {
					return /* START_DEBUG */new ParserError("Expected #id",id) ||/* STOP_DEBUG */unknown_error;
				}
				else if ((tmp = id.val.match(/(#.*?)([^a-z0-9_\-$.+=\/]).*$/i))) {
					return /* START_DEBUG */new _Grips.tokenizer.TokenizerError(
						"Unexpected token",
						new _Grips.tokenizer.Token({
							type: _Grips.tokenizer.GENERAL,
							val: tmp[2],
							pos: _Grips.tokenizer.lineCol(id.token.pos.raw + tmp.index + tmp[1].length,current_collection_id)
						})
					) ||/* STOP_DEBUG */unknown_error;
				}
				// need to add the collectionID to the Define Tag ID
				else {
					id.val = id.collection_id + id.val;
				}
			}
			else if (id.parent.type === NODE_TAG_EXTEND) {
				if ((tmp = id.val.match(/#/))) {
					return /* START_DEBUG */new _Grips.tokenizer.TokenizerError(
						"Unexpected token",
						new _Grips.tokenizer.Token({
							type: _Grips.tokenizer.GENERAL,
							val: "#",
							pos: _Grips.tokenizer.lineCol(id.token.pos.raw + tmp.index,current_collection_id)
						})
					) ||/* STOP_DEBUG */unknown_error;
				}
			}
			else if (id.parent.type === NODE_TAG_INCL_TMPL) {
				if (!(
						id.val &&
						/#.+/.test(id.val)
					)
				) {
					return /* START_DEBUG */new ParserError("Expected #id",id) ||/* STOP_DEBUG */unknown_error;
				}
				else if ((tmp = id.val.match(/(#.*?)([^a-z0-9_\-$.+=\/]).*$/i))) {
					return /* START_DEBUG */new _Grips.tokenizer.TokenizerError(
						"Unexpected token",
						new _Grips.tokenizer.Token({
							type: _Grips.tokenizer.GENERAL,
							val: tmp[2],
							pos: _Grips.tokenizer.lineCol(id.token.pos.raw + tmp.index + tmp[1].length,current_collection_id)
						})
					) ||/* STOP_DEBUG */unknown_error;
				}
			}
		}

		function validateRHExpr(expr) {
			function inLoopScope(node) {
				while (node.parent && (node = node.parent)) {
					if (node.type === _Grips.parser.TAG_LOOP) {
						return true;
					}
				}
				return false;
			}

			function inMainRef(node) {
				while (node.parent && (node = node.parent)) {
					if (node.type === _Grips.parser.MAIN_REF_EXPR ||
						node.type === _Grips.parser.ASSIGNMENT_EXPR
					) {
						return (node.type === _Grips.parser.MAIN_REF_EXPR);
					}
				}
				return false;
			}

			var i, tmp, prev_node, node, stack = [];
			if (expr.def && expr.def.length > 0) {
				for (i=0; i<expr.def.length; i++) {
					// ignore whitespace in simple expressions
					if (expr.def[i].type === NODE_WHITESPACE) {
						continue;
					}

					prev_node = node;
					node = expr.def[i];

					if (node.type === NODE_OPERATOR) {
						// check for invalid simple expression operators
						if (!/[.!\[\]\(\)]/.test(node.val)) {
							return /* START_DEBUG */new _Grips.tokenizer.TokenizerError(
								"Unexpected token",
								node.token
							) ||/* STOP_DEBUG */unknown_error;
						}

						// check for valid trailing operator
						if (i === (expr.def.length-1) &&
							!/[\]\)]/.test(node.val)
						) {
							return /* START_DEBUG */new _Grips.tokenizer.TokenizerError(
								"Unexpected token",
								node.token
							) ||/* STOP_DEBUG */unknown_error;
						}

						// check for valid operator following previous token
						if (prev_node) {
							// are there two operators in a row?
							if (prev_node.type === NODE_OPERATOR) {
								if (node.val === "(" &&
									!/[!\(\[]/.test(prev_node.val)
								) {
									return /* START_DEBUG */new ParserError("Invalid EXPR",node) ||/* STOP_DEBUG */unknown_error;
								}
								else if (node.val === "!" &&
									!/[!\(]/.test(prev_node.val)
								) {
									return /* START_DEBUG */new ParserError("Invalid EXPR",node) ||/* STOP_DEBUG */unknown_error;
								}
								else if (/[.\[\]\)]/.test(node.val) &&
									!/[\]\)]/.test(prev_node.val)
								) {
									return /* START_DEBUG */new ParserError("Invalid EXPR",node) ||/* STOP_DEBUG */unknown_error;
								}
							}
							else if (prev_node.type === NODE_TEXT &&
								!/[.\[\]\)]/.test(node.val)
							) {
								return /* START_DEBUG */new ParserError("Invalid EXPR",node) ||/* STOP_DEBUG */unknown_error;
							}
							else if (prev_node.type === NODE_STRING_LITERAL &&
								!/[\]\)]/.test(node.val)
							) {
								return /* START_DEBUG */new ParserError("Invalid EXPR",node) ||/* STOP_DEBUG */unknown_error;
							}
						}
						else if (!/[!\(]/.test(node.val)) {
							return /* START_DEBUG */new ParserError("Invalid EXPR",node) ||/* STOP_DEBUG */unknown_error;
						}

						// check [] () balance
						if (/[\[\(]/.test(node.val)) {
							stack.push(node.val);
						}
						else if (/[\]\)]/.test(node.val)) {
							// are we balanced with a matching `(` or `[`?
							if (stack.length > 0 &&
								(
									(stack[stack.length-1] === "[" && node.val === "]") ||
									(stack[stack.length-1] === "(" && node.val === ")")
								)
							) {
								stack.pop();
							}
							else {
								return /* START_DEBUG */new ParserError("Unbalanced EXPR",node) ||/* STOP_DEBUG */unknown_error;
							}
						}
					}
					else if (node.type === NODE_TEXT) {
						if (/^\d/.test(node.val)) {
							if (!/^\d+$/.test(node.val)) {
								return /* START_DEBUG */new ParserError("Invalid identifier in EXPR",node) ||/* STOP_DEBUG */unknown_error;
							}
							else if (prev_node &&
								!(
									prev_node.type === NODE_OPERATOR &&
									/[\(\[]/.test(prev_node.val)
								)
							) {
								return /* START_DEBUG */new ParserError("Unexpected number",node) ||/* STOP_DEBUG */unknown_error;
							}
						}
						tmp = inMainRef(node);
						if (expr.def.length === 1) {
							if (node.val === "_" &&
								!(
									tmp ||
									(node.parent.parent.context_expr === node.parent)
								)
							) {
								return /* START_DEBUG */new ParserError("Invalid identifier in EXPR",node) ||/* STOP_DEBUG */unknown_error;
							}
						}
						if (node.val === "_" &&
							!(
								(
									tmp &&
									inLoopScope(node.parent.parent)
								) ||
								(
									!tmp &&
									inLoopScope(node)
								)
							)
						) {
							return /* START_DEBUG */new ParserError("Unexpected Identifier in EXPR",node) ||/* STOP_DEBUG */unknown_error;
						}
						if (prev_node) {
							if (prev_node.type === NODE_TEXT) {
								return /* START_DEBUG */new ParserError("Invalid EXPR",node) ||/* STOP_DEBUG */unknown_error;
							}
							else if (prev_node.type === NODE_OPERATOR &&
								!/[.!\(\[]/.test(prev_node.val)
							) {
								return /* START_DEBUG */new ParserError("Invalid EXPR",node) ||/* STOP_DEBUG */unknown_error;
							}
						}
					}
					else if (node.type === NODE_STRING_LITERAL) {
						if (prev_node &&
							!(
								prev_node.type === NODE_OPERATOR &&
								/[\[\(]/.test(prev_node.val)
							)
						) {
							return /* START_DEBUG */new ParserError("Unexpected string literal",node) ||/* STOP_DEBUG */unknown_error;
						}
					}
				}
				if (stack.length > 0) {
					return /* START_DEBUG */new ParserError("Unbalanced EXPR",expr) ||/* STOP_DEBUG */unknown_error;
				}
			}
			else {
				return /* START_DEBUG */new ParserError("Expected EXPR",expr) ||/* STOP_DEBUG */unknown_error;
			}
		}

		function validateRangeExpr(expr) {
			if (expr.def && expr.def.length === 5) {
				if (!(
						expr.def[1].type === NODE_TEXT &&
						/^-?\d+$/.test(expr.def[1].val)
					)
				) {
					return /* START_DEBUG */new ParserError("Invalid range literal",expr.def[1]) ||/* STOP_DEBUG */unknown_error;
				}
				else if (!(
						expr.def[3].type === NODE_TEXT &&
						/^-?\d+$/.test(expr.def[3].val)
					)
				) {
					return /* START_DEBUG */new ParserError("Invalid range literal",expr.def[3]) ||/* STOP_DEBUG */unknown_error;
				}
				else if (!(
						expr.def[2].type === NODE_OPERATOR &&
						expr.def[2].val === ".."
					)
				) {
					return /* START_DEBUG */new ParserError("Invalid range literal",expr.def[2]) ||/* STOP_DEBUG */unknown_error;
				}
			}
			else {
				return /* START_DEBUG */new ParserError("Expected range literal",expr) ||/* STOP_DEBUG */unknown_error;
			}
		}

		function validateSetExpr(expr) {
			var i, prev_node, node;
			if (expr.def && expr.def.length >= 5) {
				for (i=1; i<expr.def.length-1; i++) {
					prev_node = node;
					node = expr.def[i];

					if (node.type === NODE_STRING_LITERAL) {
						if (prev_node &&
							!(
								prev_node.type === NODE_OPERATOR &&
								prev_node.val === ","
							)
						) {
							return /* START_DEBUG */new ParserError("Invalid set literal",node) ||/* STOP_DEBUG */unknown_error;
						}
					}
					else if (node.type === NODE_OPERATOR &&
						node.val === ","
					) {
						if (!(
								prev_node &&
								prev_node.type === NODE_STRING_LITERAL
							)
						) {
							return /* START_DEBUG */new ParserError("Invalid set literal",node) ||/* STOP_DEBUG */unknown_error;
						}
					}
					else {
						return /* START_DEBUG */new ParserError("Invalid set literal",node) ||/* STOP_DEBUG */unknown_error;
					}
				}
				if (expr.def[expr.def.length-2].type !== NODE_STRING_LITERAL) {
					return /* START_DEBUG */new ParserError("Invalid set literal",expr.def[expr.def.length-2]) ||/* STOP_DEBUG */unknown_error;
				}
			}
			else {
				return /* START_DEBUG */new ParserError("Expected set literal",expr) ||/* STOP_DEBUG */unknown_error;
			}
		}

		function validateAssignmentExpr(expr) {
			var i, j, prev_node, node, tmp, tmp2, def = [],
				lh_expr, rh_expr
			;

			if (expr.def && expr.def.length > 0) {
				for (i=0; i<expr.def.length; i++) {
					// ignore whitespace in simple expressions
					if (expr.def[i].type === NODE_WHITESPACE) {
						continue;
					}

					prev_node = node;
					node = expr.def[i];

					// handling LH of assignment statement?
					if (!lh_expr) {
						if (node.type === NODE_OPERATOR) {
							if (node.val === "=") {
								lh_expr = new Node({
									parent: expr,
									type: NODE_REF_EXPR,
									token: def[0].token,
									def: def
								});

								// is this NOT a special set-literal ref expression?
								if (!(
										def[0] &&
										def[0].type === NODE_REF_EXPR &&
										def[1] &&
										(
											def[1].type === NODE_SET_LITERAL ||
											def[1].type === NODE_RANGE_LITERAL
										)
									)
								) {
									// validate the regular ref expression
									err = validateRefExpr(lh_expr);
									if (err) {
										return err;
									}
								}

								// remap `parent`s
								for (j=0; j<lh_expr.def.length; j++) {
									lh_expr.def[j].parent = lh_expr;
								}

								def = [];
							}
							else if (node.val === "[") {
								// are we starting a bracket-literal (which needs special handling)?
								tmp = identifyBracketLiteral(expr.def.slice(i));
								if (tmp) {
									tmp2 = new Node({
										parent: null,
										type: NODE_REF_EXPR,
										token: expr.def[0].token,
										def: expr.def.slice(0,i)
									});
									err = validateRefExpr(tmp2);
									// is the preceeding expression a valid ref expression?
									if (!err) {
										def = [tmp2];

										tmp2 = new Node({
											parent: null,
											type: NODE_RANGE_LITERAL,
											token: node.token,
											def: tmp
										});

										err = validateRangeExpr(tmp2);
										// not a valid set-literal?
										if (err) {
											tmp2.type = NODE_SET_LITERAL;
											err = validateSetExpr(tmp2);
										}

										// valid bracket-literal?
										if (!err) {
											def.push(tmp2);

											// set up loop index for next iteration
											i += (tmp.length - 1);

											// remove operators from the bracket-literal
											discardOperators(tmp2.def);
										}
										else {
											err = /* START_DEBUG */new ParserError("Invalid bracket literal",node) ||/* STOP_DEBUG */unknown_error;
										}
									}

									if (err) {
										return err;
									}
								}
								// otherwise just keep processing the expression nodes
								else {
									def.push(node);
								}
							}
							else if (!(
									prev_node &&
									/[.\[\]]/.test(node.val)
								)
							) {
								return /* START_DEBUG */new ParserError("Invalid statement EXPR",node) ||/* STOP_DEBUG */unknown_error;
							}
							else {
								def.push(node);
							}
						}
						else {
							def.push(node);
						}
					}
					// otherwise, handle RH of assignment statement
					else {
						tmp = stripOuterGroupings(expr.def.slice(i));

						if (tmp.length === 0) {
							return /* START_DEBUG */new ParserError("Expected EXPR",node) ||/* STOP_DEBUG */unknown_error;
						}

						// setup the RH expression node
						rh_expr = new Node({
							parent: expr,
							type: NODE_VAL_EXPR,
							token: tmp[0].token,
							def: []
						});

						tmp2 = identifyConditionalExpr(tmp);

						// was the RH expr NOT a conditional?
						if (!tmp2) {
							rh_expr.def = tmp;

							err = validateValueExpr(rh_expr);
							if (err) {
								return err;
							}
						}
						// was a valid conditional
						else {
							rh_expr.def = [tmp2];
						}

						// remap `parent`s
						for (j=0; j<rh_expr.def.length; j++) {
							rh_expr.def[j].parent = rh_expr;
						}

						break;
					}
				}

				if (lh_expr && rh_expr) {
					lh_expr.def = stripWhitespace(lh_expr.def);
					rh_expr.def = stripWhitespace(rh_expr.def);

					// update original node with statement's parsed structure
					expr.def = [lh_expr,rh_expr];
					expr.type = NODE_ASSIGNMENT_EXPR;
				}
				else return /* START_DEBUG */new ParserError("Invalid assignment statement",expr) ||/* STOP_DEBUG */unknown_error;
			}
			else {
				return /* START_DEBUG */new ParserError("Expected assignment statement",expr) ||/* STOP_DEBUG */unknown_error;
			}
		}

		function validateValueExpr(expr) {
			var i, node, ret, identifier_found = false;
			if (expr.def && expr.def.length > 0) {
				for (i=0; i<expr.def.length; i++) {
					node = expr.def[i];
					if (node.type === NODE_OPERATOR) {
						if (node.val === "!") {
							return /* START_DEBUG */new _Grips.tokenizer.TokenizerError(
								"Unexpected token",
								node.token
							) ||/* STOP_DEBUG */unknown_error;
						}
					}
					else if (node.type === NODE_TEXT) {
						if (!/^\d+$/.test(node.val)) {
							identifier_found = true;
						}
						else if (!identifier_found) {
							return /* START_DEBUG */new ParserError("Unexpected number",node) ||/* STOP_DEBUG */unknown_error;
						}
					}
				}
			}
			else {
				return /* START_DEBUG */new ParserError("Expected EXPR",expr) ||/* STOP_DEBUG */unknown_error;
			}

			ret = validateRHExpr(expr);
			if (ret) return ret;
		}

		function validateRefExpr(expr) {
			var i, prev_node, node, ret;
			if (expr.def && expr.def.length > 0) {
				for (i=0; i<expr.def.length; i++) {
					// ignore whitespace in simple expressions
					if (expr.def[i].type === NODE_WHITESPACE) {
						continue;
					}

					prev_node = node;
					node = expr.def[i];

					if (node.type === NODE_STRING_LITERAL &&
						!(
							prev_node &&
							prev_node.type === NODE_OPERATOR &&
							prev_node.val === "["
						)
					) {
						return /* START_DEBUG */new ParserError("Unexpected string literal",node) ||/* STOP_DEBUG */unknown_error;
					}
				}
			}
			else {
				return /* START_DEBUG */new ParserError("Expected EXPR",expr) ||/* STOP_DEBUG */unknown_error;
			}

			ret = validateValueExpr(expr);
			if (ret) return ret;
		}


		var ret, ret2, ret3, err, i;

		if (node.type === NODE_TAG_EXTEND) {
			if (!(node.id && (ret = parse(node.id)))) {
				throw /* START_DEBUG */new ParserError("Expected collection ID for Extend Tag",node) ||/* STOP_DEBUG */unknown_error;
			}
			node.id = ret;

			// is there any non-whitespace left in the Tag declaration?
			if (node.def && node.def.length > 0) {
				node.def[0] = node.id;

				if (node.def.length > 1) {
					for (i=1; i<node.def.length; i++) {
						if (node.def[i].type !== NODE_WHITESPACE) {
							throw /* START_DEBUG */new ParserError("Unexpected",node.def[i]) ||/* STOP_DEBUG */unknown_error;
						}
					}

					node.def = [node.id];
				}
			}

			return node;
		}
		else if (node.type === NODE_TAG_DEFINE) {
			if (!(node.id && (ret = parse(node.id)))) {
				throw /* START_DEBUG */new ParserError("Expected #id for Tag",node) ||/* STOP_DEBUG */unknown_error;
			}
			node.id = ret;

			// do we need to parse the Tag's declaration?
			if (node.def && node.def.length > 0) {
				ret = [node.id];
				ret3 = stripWhitespace(node.def.slice(1));
				for (i=0; i<ret3.length; i++) {
					ret2 = parse(ret3[i]);
					if (ret2) ret.push(ret2);
				}
				node.def = ret;
			}

			// do we need to parse the Tag's children?
			if (node.children && node.children.length > 0) {
				node.children = combineNodes(node.children);
				ret = [];
				for (i=0; i<node.children.length; i++) {
					ret2 = parse(node.children[i]);
					if (ret2) ret.push(ret2);
				}
				node.children = combineNodes(ret);
			}

			return node;
		}
		else if (node.type === NODE_TAG_LOOP) {
			if (!(node.main_expr && (ret = parse(node.main_expr)))) {
				throw /* START_DEBUG */new ParserError("Expected EXPR for Tag",node) ||/* STOP_DEBUG */unknown_error;
			}
			node.main_expr = ret;

			// do we need to parse the Tag's declaration?
			if (node.def && node.def.length > 0) {
				ret = [node.main_expr];
				ret3 = stripWhitespace(node.def.slice(1));
				for (i=0; i<ret3.length; i++) {
					ret2 = parse(ret3[i]);
					if (ret2) ret.push(ret2);
				}
				node.def = ret;
			}

			// do we need to parse the Tag's children?
			if (node.children && node.children.length > 0) {
				node.children = combineNodes(node.children);
				ret = [];
				for (i=0; i<node.children.length; i++) {
					ret2 = parse(node.children[i]);
					if (ret2) ret.push(ret2);
				}
				node.children = combineNodes(ret);
			}

			return node;
		}
		else if (node.type === NODE_TAG_LET) {
			// parse the Tag's declaration
			if (node.def && node.def.length > 0) {
				ret = stripWhitespace(node.def);
				for (i=0; i<ret.length; i++) {
					ret2 = parse(ret[i]);
					if (ret2) ret[i] = ret2;
				}
				node.def = ret;
			}
			else {
				throw /* START_DEBUG */new ParserError("Expected EXPR in Tag",node) ||/* STOP_DEBUG */unknown_error;
			}

			// do we need to parse the Tag's children?
			if (node.children && node.children.length > 0) {
				node.children = combineNodes(node.children);
				ret = [];
				for (i=0; i<node.children.length; i++) {
					ret2 = parse(node.children[i]);
					if (ret2) ret.push(ret2);
				}
				node.children = combineNodes(ret);
			}

			return node;
		}
		else if (node.type === NODE_TAG_INSERT_VAR) {
			if (!(node.main_expr && (ret = parse(node.main_expr)))) {
				throw /* START_DEBUG */new ParserError("Expected EXPR for Tag",node) ||/* STOP_DEBUG */unknown_error;
			}
			node.main_expr = ret;

			// besides the main EXPR, is there any non-whitespace left in the Tag declaration?
			if (node.def && node.def.length > 0) {
				if (node.def.length > 1) {
					for (i=1; i<node.def.length; i++) {
						if (node.def[i].type !== NODE_WHITESPACE) {
							throw /* START_DEBUG */new ParserError("Unexpected",node.def[i]) ||/* STOP_DEBUG */unknown_error;
						}
					}
				}

				node.def = [node.main_expr];
			}

			return node;
		}
		else if (node.type === NODE_TAG_INCL_TMPL) {
			if (!(node.main_expr && (ret = parse(node.main_expr)))) {
				throw /* START_DEBUG */new ParserError("Expected template reference EXPR for Tag",node) ||/* STOP_DEBUG */unknown_error;
			}
			node.main_expr = ret;

			node.context_expr.type = NODE_REF_EXPR;
			node.context_expr.def = stripWhitespace(node.context_expr.def);
			err = validateValueExpr(node.context_expr);
			if (err) {
				throw err;
			}

			node.def = [node.main_expr,node.context_expr];

			return node;
		}
		else if (node.type === NODE_TAG_RAW) {
			node.type = NODE_TEXT;

			return node;
		}
		else if (node.type === NODE_ID) {
			if ((err = validateTagID(node))) {
				throw err;
			}

			return node;
		}
		else if (node.type === NODE_GENERAL_EXPR) {
			if (node.def && node.def.length > 0) {
				node.def = combineWhitespaceNodes(node.def);
				node.def = stripWhitespace(node.def);

				err = validateAssignmentExpr(node);
				if (err) {
					throw err;
				}
			}
			else {
				throw /* START_DEBUG */new ParserError("Expected EXPR",node) ||/* STOP_DEBUG */unknown_error;
			}

			return node;
		}
		else if (node.type === NODE_MAIN_REF_EXPR) {
			if (node.def && node.def.length > 0) {
				// remove all whitespace from a main expr
				ret = [];
				for (i=0; i<node.def.length; i++) {
					if (node.def[i].type !== NODE_WHITESPACE) {
						ret.push(node.def[i]);
					}
				}
				node.def = stripOuterGroupings(ret);

				// can we infer that this expression is a bracket literal type?
				if ((ret = identifyBracketLiteral(node.def)) &&
					ret.length === node.def.length
				) {
					ret = new Node({
						parent: node,
						type: null,
						token: node.token,
						def: ret
					});
					// remap `parent`s
					for (i=0; i<ret.def.length; i++) {
						ret.def[i].parent = ret;
					}

					err = validateRangeExpr(node);
					if (!err) {
						ret.type = NODE_RANGE_LITERAL;
					}
					else {
						err = validateSetExpr(node);
						if (!err) {
							ret.type = NODE_SET_LITERAL;
						}
					}

					if (err) {
						throw /* START_DEBUG */new ParserError("Invalid bracket literal",node) ||/* STOP_DEBUG */unknown_error;
					}
					else {
						// remove operators from the bracket-literal
						discardOperators(ret.def);

						node.def = [ret];
					}
				}
				else if (node.parent.type === NODE_TAG_INSERT_VAR ||
					node.parent.type === NODE_TAG_LOOP
				) {
					err = validateRefExpr(node);
				}
				else if (node.parent.type === NODE_TAG_INCL_TMPL) {
					err = validateValueExpr(node);
				}

				if (err) {
					throw err;
				}
			}
			else {
				throw /* START_DEBUG */new ParserError("Expected EXPR",node) ||/* STOP_DEBUG */unknown_error;
			}

			return node;
		}
		else if (node.type === NODE_TEXT) {
			if (!node.parent && node.token.type !== _Grips.tokenizer.WHITESPACE) {
				throw /* START_DEBUG */new ParserError("Unexpected text outside of tag",node) ||/* STOP_DEBUG */unknown_error;
			}
			if (node.val !== "") {
				return node;
			}
		}
		else if (node.type === NODE_COLLECTION_MARKER) {
			if (node.start) {
				current_collection_id = node.start;
			}
			else if (node.close) {
				current_collection_id = null;
			}
			return node;
		}
		else {
			return node;
		}
	}

	function parseNextNode() {
		var ret;
		// go until we find a node that parsed well, or we run out of nodes
		while (node_idx < nodes.length && !ret && nodes[node_idx].complete) {
			ret = parse(nodes[node_idx++]);
		}
		return ret;
	}


	var nodes = [],
		current_parent,
		current_collection_id = "",
		node_idx = 0,

		NODE_STATE_OUTSIDE = 0,
		NODE_STATE_INSIDE = 1,
		NODE_STATE_RAW = 2,
		NODE_STATE_COMMENT = 3,
		NODE_STATE_LITERAL = 4,
		NODE_STATE_INVALID = 5,

		NODE_TEXT = 0,
		NODE_TAG_EXTEND = 1,
		NODE_TAG_DEFINE = 2,
		NODE_TAG_INCL_TMPL = 3,
		NODE_TAG_INSERT_VAR = 4,
		NODE_TAG_LOOP = 5,
		NODE_TAG_RAW = 6,
		NODE_TAG_COMMENT = 7,
		NODE_ID = 8,
		NODE_MAIN_REF_EXPR = 9,
		NODE_GENERAL_EXPR = 10,
		NODE_ASSIGNMENT_EXPR = 11,
		NODE_REF_EXPR = 12,
		NODE_VAL_EXPR = 13,
		NODE_CONDITIONAL_EXPR = 14,
		NODE_BOOLEAN_EXPR = 15,
		NODE_STRING_LITERAL = 16,
		NODE_RANGE_LITERAL = 17,
		NODE_SET_LITERAL = 18,
		NODE_WHITESPACE = 19,
		NODE_OPERATOR = 20,
		NODE_COLLECTION_MARKER = 21,
		NODE_TAG_ESCAPE = 22,
		NODE_TAG_LET = 23,

		instance_api,

		unknown_error = new Error("Unknown error")
	;

	instance_api = {
		OUTSIDE: NODE_STATE_OUTSIDE,
		INSIDE: NODE_STATE_INSIDE,
		RAW: NODE_STATE_RAW,
		COMMENT: NODE_STATE_COMMENT,
		LITERAL: NODE_STATE_LITERAL,
		INVALID: NODE_STATE_INVALID,

		TEXT: NODE_TEXT,
		TAG_EXTEND: NODE_TAG_EXTEND,
		TAG_DEFINE: NODE_TAG_DEFINE,
		TAG_INCL_TMPL: NODE_TAG_INCL_TMPL,
		TAG_INSERT_VAR: NODE_TAG_INSERT_VAR,
		TAG_LOOP: NODE_TAG_LOOP,
		TAG_RAW: NODE_TAG_RAW,
		TAG_COMMENT: NODE_TAG_COMMENT,
		ID: NODE_ID,
		MAIN_REF_EXPR: NODE_MAIN_REF_EXPR,
		GENERAL_EXPR: NODE_GENERAL_EXPR,
		ASSIGNMENT_EXPR: NODE_ASSIGNMENT_EXPR,
		REF_EXPR: NODE_REF_EXPR,
		VAL_EXPR: NODE_VAL_EXPR,
		CONDITIONAL_EXPR: NODE_CONDITIONAL_EXPR,
		BOOLEAN_EXPR: NODE_BOOLEAN_EXPR,
		STRING_LITERAL: NODE_STRING_LITERAL,
		RANGE_LITERAL: NODE_RANGE_LITERAL,
		SET_LITERAL: NODE_SET_LITERAL,
		WHITESPACE: NODE_WHITESPACE,
		OPERATOR: NODE_OPERATOR,
		COLLECTION_MARKER: NODE_COLLECTION_MARKER,
		TAG_ESCAPE: NODE_TAG_ESCAPE,
		TAG_LET: NODE_TAG_LET,

		state: NODE_STATE_OUTSIDE,

		nodify: nodify,
		end: end,
		parseNextNode: parseNextNode,

		/* START_DEBUG */ParserError: ParserError,/* STOP_DEBUG */
		Node: Node
	};

	_Grips.parser = instance_api;

})(this,this.grips);
/* STOP_COMPILER */
