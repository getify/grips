(function(global){

	/* Node */
	Node = function(props) {
		for (var i in props) { if (props.hasOwnProperty(i)) {
			this[i] = props[i];
		}}
	};
	Node.prototype.toString = function() {
		function showLiteral(node) {
			return node.delimiter + node.token.val + node.delimiter;
		}

		function showDeclaration(node) {
			var i, ret = "";
			for (var i=0; i<node.decl.length; i++) {
				ret += node.decl[i].toString();
			}
			return ret;
		}

		function showChildren(node) {
			var i, ret = "";
			for (var i=0; i<node.children.length; i++) {
				ret += node.children[i].toString();
			}
			return ret;
		}

		var ret = JSON.stringify(this);
		if (this.type === NODE_TAG_DEFINE) {
			ret = "{$: ";
			if (this.id) {
				ret += this.id.toString();
			}
		}
		else if (this.type === NODE_TAG_EXTEND) {
			ret = "{$+ ";
			if (this.id) {
				ret += this.id.toString();
			}
		}
		else if (this.type === NODE_TAG_INCL_TMPL) {
			ret = "{$= @";
			if (this.main_expr) {
				ret += this.main_expr.toString();
			}
		}
		else if (this.type === NODE_TAG_INCL_VAR) {
			ret = "{$= ";
			if (this.main_expr) {
				ret += this.main_expr.toString();
			}
		}
		else if (this.type === NODE_TAG_LOOP) {
			ret = "{$* ";
			if (this.main_expr) {
				ret += this.main_expr.toString();
			}
		}
		else if (this.type === NODE_TAG_RAW) {
			ret = "{$% " + showChildren(this);
		}
		else if (this.type === NODE_ID ||
			this.type === NODE_LITERAL_EXPR
		) {
			ret = this.token.val;
		}
		else if (this.type === NODE_EXPR ||
			this.type === NODE_MAIN_EXPR
		) {
			ret = showDeclaration(this);
		}
		else if (this.type === NODE_TEXT) {
			ret = this.val;
		}
		else if (this.type === NODE_WHITESPACE) {
			ret = " ";
		}

		return ret;
	};

	/* ParserError */
	var ParserError = (function() {
		function F(){}
		function CustomError(msg,ref) {
			// correct if not called with "new"
			var self = (this===window) ? new F() : this;
			self.message = msg;
			self.ref = ref;
			return self;
		}
		F.prototype = CustomError.prototype = Object.create(SyntaxError.prototype);
		CustomError.prototype.constructor = CustomError;

		CustomError.prototype.toString = function() {
			var ref_str = "";
			if (this.ref) {
				if (this.ref instanceof global.grips.tokenizer.Token) {
					ref_str = "; " + this.ref.toString();
				}
				else if (this.ref instanceof Node) {
					ref_str = "; `" + this.ref.toString() + "`; position: " + this.ref.token.pos + "; type: " + this.ref.type;
				}
				else {
					ref_str = "; " + this.ref;
				}
			}
			return "ParserError: " + this.message + ref_str;
		};
		return CustomError;
	})();


	/* Parser */
	function nodify(tokens,filename) {
		function handleOutsideState(token) {
			if (token.type === global.grips.tokenizer.OPEN) {
				node = new Node({
					parent: null,
					type: null,
					token: token,
					decl: [],
					children: []
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
			else if (token.type === global.grips.tokenizer.GENERAL) {
				node = new Node({
					parent: null,
					type: NODE_TEXT,
					token: token
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
			else if (current_parent && token.type === global.grips.tokenizer.WHITESPACE) {
				node = new Node({
					parent: current_parent,
					type: NODE_TEXT,
					token: token
				});
				current_parent.children.push(node);
			}
			else if (token.type === global.grips.tokenizer.BLOCK_FOOTER) {
				if (current_parent && current_parent.close_header === global.grips.tokenizer.BLOCK_HEAD_CLOSE) {
					current_parent = current_parent.parent;
				}
				else {
					instance_api.state = NODE_STATE_INVALID;
					return new ParserError("Unexpected Tag",token);
				}
			}
		}

		function handleInsideState(token) {
			if (token.type === global.grips.tokenizer.SIGNIFIER) {
				if (current_parent && current_parent.type == null) {
					if (token.val === ":") current_parent.type = NODE_TAG_DEFINE;
					else if (token.val === "+") current_parent.type = NODE_TAG_EXTEND;
					else if (token.val === "=") current_parent.type = NODE_TAG_INCL_VAR; // NOTE: can later be re-defined to NODE_TAG_INCL_TMPL if `@` is found subsequently
					else if (token.val === "*") current_parent.type = NODE_TAG_LOOP;
					else if (token.val === "%") current_parent.type = NODE_TAG_RAW;
					else if (token.val === "/") current_parent.type = NODE_TAG_COMMENT;

					// special handling for various tag types
					if (current_parent.type === NODE_TAG_EXTEND ||
						current_parent.type === NODE_TAG_INCL_VAR
					) {
						current_parent.close_header = global.grips.tokenizer.SIMPLE_CLOSE;
						delete current_parent.children; // these tag types don't have `children`
					}
					else if (current_parent.type === NODE_TAG_DEFINE ||
						current_parent.type === NODE_TAG_LOOP
					) {
						current_parent.close_header = global.grips.tokenizer.BLOCK_HEAD_CLOSE;
					}
					else if (current_parent.type === NODE_TAG_RAW) {
						current_parent.val = "";
						instance_api.state = NODE_STATE_RAW;
						delete current_parent.decl; // raw tags don't have a declaration
					}
					else if (current_parent.type === NODE_TAG_COMMENT) {
						current_parent.val = "";
						instance_api.state = NODE_STATE_COMMENT;
						delete current_parent.decl; // comment tags don't have a declaration
						delete current_parent.children; // comment tags don't have `children`
					}

					// is top-level tag that's invalid?
					if (current_parent.parent == null &&
						!(
							current_parent.type === NODE_TAG_EXTEND ||
							current_parent.type === NODE_TAG_DEFINE ||
							current_parent.type === NODE_TAG_COMMENT
						)
					) {
						instance_api.state = NODE_STATE_INVALID;
						return new ParserError("Unexpected Tag",current_parent);
					}
				}
				else {
					instance_api.state = NODE_STATE_INVALID;
					return new global.grips.tokenizer.TokenizerError("Unexpected token",token);
				}
			}
			else if (token.type === global.grips.tokenizer.WHITESPACE) {
				if (current_parent) {
					if (current_parent.type === NODE_TAG_EXTEND ||
						current_parent.type === NODE_TAG_DEFINE ||
						current_parent.type === NODE_TAG_INCL_TMPL ||
						current_parent.type === NODE_TAG_INCL_VAR ||
						current_parent.type === NODE_TAG_LOOP ||
						current_parent.type === NODE_EXPR ||
						current_parent.type === NODE_MAIN_EXPR
					) {
						// is this node's declaration already in progress?
						if (current_parent.decl.length > 0) {
							// keep the whitespace node (could be relevant)
							current_parent.decl.push(new Node({
								parent: current_parent,
								type: NODE_WHITESPACE,
								token: token
							}));
						}
						// otherwise, ignore the whitespace node
					}
					else {
						instance_api.state = NODE_STATE_INVALID;
						return new global.grips.tokenizer.TokenizerError("Unexpected token",token);
					}
				}
				// NOTE: we ignore whitespace tokens if they're not inside a tag (parent)
			}
			// redefine include as a template-include?
			else if (token.type === global.grips.tokenizer.AT) {
				if (current_parent && 
					current_parent.type === NODE_TAG_INCL_VAR &&
					current_parent.decl.length === 0 // is the node's declaration not yet defined?
				) {
					current_parent.type = NODE_TAG_INCL_TMPL;
				}
				else {
					instance_api.state = NODE_STATE_INVALID;
					return new global.grips.tokenizer.TokenizerError("Unexpected token",token);
				}
			}
			else if (
				token.type === global.grips.tokenizer.SINGLE_QUOTE ||
				token.type === global.grips.tokenizer.DOUBLE_QUOTE
			) {
				if (current_parent && 
					(
						current_parent.type === NODE_TAG_EXTEND ||
						current_parent.type === NODE_TAG_DEFINE ||
						current_parent.type === NODE_TAG_INCL_TMPL ||
						current_parent.type === NODE_EXPR ||
						current_parent.type === NODE_MAIN_EXPR
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
								node.filename = filename;
							}
						}
						else if (current_parent.type === NODE_TAG_DEFINE) {

						}
						else {
							instance_api.state = NODE_STATE_INVALID;
							return new global.grips.tokenizer.TokenizerError("Unexpected token",token);
						}
					}
					else if (current_parent.type === NODE_TAG_INCL_TMPL) {
						if (!current_parent.main_expr) {
							current_parent.main_expr = node;
							node.type = NODE_ID;
							node.filename = filename;
						}
						else {
							instance_api.state = NODE_STATE_INVALID;
							return new global.grips.tokenizer.TokenizerError("Unexpected token",token);
						}
					}
					else {
						node.type = NODE_LITERAL_EXPR;
					}

					current_parent.decl.push(node);
					current_parent = node;
				}
				else {
					instance_api.state = NODE_STATE_INVALID;
					return new global.grips.tokenizer.TokenizerError("Unexpected token",token);
				}
			}
			else if (token.type === global.grips.tokenizer.OPERATOR) {
				if (current_parent &&
					(
						current_parent.type === NODE_EXPR ||
						current_parent.type === NODE_MAIN_EXPR
					)
				) {
					current_parent.decl.push(new Node({
						parent: current_parent,
						type: NODE_OPERATOR,
						token: token,
						val: token.val
					}));
				}
				else {
					instance_api.state = NODE_STATE_INVALID;
					return new global.grips.tokenizer.TokenizerError("Unexpected token",token);
				}
			}
			else if (token.type === global.grips.tokenizer.PIPE) {
				if (current_parent) {
					// is this PIPE delimiting a previous EXPR node?
					if (current_parent.type === NODE_EXPR ||
						current_parent.type === NODE_MAIN_EXPR
					) {
						current_parent = current_parent.parent;
					}

					// did we fail to see a Tag ID where one is expected?
					if (!current_parent.id && 
						(
							current_parent.type === NODE_TAG_DEFINE ||
							current_parent.type === NODE_TAG_EXTEND
						)
					) {
						instance_api.state = NODE_STATE_INVALID;
						return new ParserError("Expected #id for Tag",current_parent);
					}

					if (current_parent.type === NODE_TAG_DEFINE ||
						current_parent.type === NODE_TAG_LOOP
					) {
						node = new Node({
							parent: current_parent,
							type: NODE_EXPR,
							token: null,
							decl: []
						});
						current_parent.decl.push(node);
						current_parent = node;
					}
					else {
						instance_api.state = NODE_STATE_INVALID;
						return new global.grips.tokenizer.TokenizerError("Unexpected token",token);
					}
				}
				else {
					instance_api.state = NODE_STATE_INVALID;
					return new global.grips.tokenizer.TokenizerError("Unexpected token",token);
				}
			}
			else if (token.type === global.grips.tokenizer.SIMPLE_CLOSE) {
				if (current_parent) {
					// do we need to close the current EXPR node?
					if (current_parent.type === NODE_EXPR ||
						current_parent.type === NODE_MAIN_EXPR
					) {
						current_parent = current_parent.parent;
					}

					// did we fail to see a Tag ID where one is expected?
					if (!current_parent.id && current_parent.type === NODE_TAG_EXTEND) {
						instance_api.state = NODE_STATE_INVALID;
						return new ParserError("Expected #id for Tag",current_parent);
					}

					if (current_parent.close_header === global.grips.tokenizer.SIMPLE_CLOSE) {
						instance_api.state = NODE_STATE_OUTSIDE;
						current_parent = current_parent.parent;
					}
					else {
						instance_api.state = NODE_STATE_INVALID;
						return new ParserError("Unexpected Tag closure",token);
					}
				}
				else {
					instance_api.state = NODE_STATE_INVALID;
					return new global.grips.tokenizer.TokenizerError("Unexpected token",token);
				}
			}
			else if (token.type === global.grips.tokenizer.BLOCK_HEAD_CLOSE) {
				if (current_parent) {
					// do we need to close the current EXPR node?
					if (current_parent.type === NODE_EXPR ||
						current_parent.type === NODE_MAIN_EXPR
					) {
						current_parent = current_parent.parent;
					}

					// did we fail to see a Tag ID where one is expected?
					if (!current_parent.id && current_parent.type === NODE_TAG_DEFINE) {
						instance_api.state = NODE_STATE_INVALID;
						return new ParserError("Expected #id for Tag",current_parent);
					}

					if (current_parent.close_header === global.grips.tokenizer.BLOCK_HEAD_CLOSE) {
						instance_api.state = NODE_STATE_OUTSIDE;
					}
					else {
						instance_api.state = NODE_STATE_INVALID;
						return new ParserError("Unexpected Tag closure",token);
					}
				}
				else {
					instance_api.state = NODE_STATE_INVALID;
					return new global.grips.tokenizer.TokenizerError("Unexpected token",token);
				}
			}
			else if (token.type === global.grips.tokenizer.GENERAL) {
				if (current_parent) {
					// do we need to implicitly switch to EXPR processing for this tag?
					if (current_parent.type === NODE_TAG_INCL_VAR ||
						current_parent.type === NODE_TAG_INCL_TMPL ||
						current_parent.type === NODE_TAG_LOOP
					) {
						node = new Node({
							parent: current_parent,
							type: null,
							token: null,
							decl: []
						});

						// main EXPR in a LOOP tag?
						if (!current_parent.main_expr &&
							current_parent.type === NODE_TAG_LOOP
						) {
							current_parent.main_expr = node;
							node.type = NODE_MAIN_EXPR;
						}
						// main EXPR in an INCL tag?
						else if (current_parent.type === NODE_TAG_INCL_VAR ||
							current_parent.type === NODE_TAG_INCL_TMPL
						) {
							if (!current_parent.main_expr) {
								current_parent.main_expr = node;
								node.type = NODE_MAIN_EXPR;
							}
							else {
								instance_api.state = NODE_STATE_INVALID;
								return new ParserError("Unexpected token",token);
							}
						}
						// otherwise, just an additional EXPR
						else {
							node.type = NODE_EXPR;
						}

						current_parent.decl.push(node);
						current_parent = node;
					}

					if (current_parent.type === NODE_EXPR ||
						current_parent.type === NODE_MAIN_EXPR 
					) {
						current_parent.decl.push(new Node({
							parent: current_parent,
							type: NODE_TEXT,
							token: token,
							val: token.val
						}));
					}
					else {
						instance_api.state = NODE_STATE_INVALID;
						return new ParserError("Unexpected token",token);
					}
				}
				else {
					instance_api.state = NODE_STATE_INVALID;
					return new ParserError("Unexpected token",token);
				}
			}
		}

		function handleRawState(token) {
			if (token.type === global.grips.tokenizer.GENERAL) {
				// if this raw node's token isn't yet assigned, this current token should be it
				if (current_parent.token.type !== global.grips.tokenizer.GENERAL) {
					current_parent.token = token;
				}

				current_parent.val += token.val;
			}
			else if (token.type === global.grips.tokenizer.RAW_CLOSE) {
				current_parent = current_parent.parent;
				instance_api.state = NODE_STATE_OUTSIDE;
			}
			else {
				return new ParserError("Unexpected token",token);
			}
		}

		function handleCommentState(token) {
			if (token.type === global.grips.tokenizer.COMMENT_CLOSE) {
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

		function handleLiteralState(token) {
			if (token.type === global.grips.tokenizer.GENERAL) {
				// if this literal node's token isn't yet assigned, this current token should be it
				if (current_parent.token.type !== global.grips.tokenizer.GENERAL) {
					current_parent.token = token;
				}

				current_parent.val += token.val;
			}
			else if (
				(
					token.type === global.grips.tokenizer.SINGLE_QUOTE ||
					token.type === global.grips.tokenizer.DOUBLE_QUOTE
				) &&
				current_parent.delimiter === token.val
			) {
				current_parent = current_parent.parent;
				instance_api.state = NODE_STATE_INSIDE;
			}
			else {
				return new ParserError("Unexpected token",token);
			}
		}


		var idx, node, res,
			state_handlers = [
				handleOutsideState,
				handleInsideState,
				handleRawState,
				handleCommentState,
				handleLiteralState
			]
		;

		for (idx=0; idx<tokens.length; idx++) {
			if (instance_api.state === NODE_STATE_INVALID) {
				return new ParserError("Invalid parser state");
			}

			// invoke the parser state handler
			res = state_handlers[instance_api.state](tokens[idx]);
			if (res) return res;
		}

		return true;
	}

	function combineNodes(nodes) {
		var start, end, i, j;

		for (i=0; i<nodes.length; i++) {
			if (nodes[i].type === NODE_TEXT) {
				start = end = i;
				for (j=start+1; j<nodes.length; j++) {
					end = j;
					if (nodes[j].type !== NODE_TEXT) {
						end = j-1;
						break;
					}
				}
				if (end > start) {
					for (j=start+1; j<=end; j++) {
						nodes[start].token.val += nodes[j].token.val;
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
						end = j-1;
						break;
					}
				}
				if (end > start) {
					for (j=start+1; j<=end; j++) {
						nodes[start].token.val += nodes[j].token.val;
					}
					nodes.splice(start+1,end-start);
				}
				else i = j;
			}
		}

		return nodes;
	}

	function parse(node) {
		function validateTagID(id) {
			var tmp;
			if ((tmp = id.val.match(/#/g)) && tmp.length > 1) {
				return new ParserError("Unexpected extra #id",id);
			}
			else if (id.parent.type === NODE_TAG_DEFINE) {
				if (!id.val) {
					return new ParserError("Expected #id",id);
				}
				else if ((tmp = id.val.match(/(#.*?)([^a-z0-9_\-$.]).*$/i))) {
					return new ParserError("Unexpected token",new global.grips.tokenizer.Token({
						type: global.grips.tokenizer.GENERAL,
						val: tmp[2],
						pos: id.token.pos + tmp.index + tmp[1].length
					}));
				}
				else if (!id.val.match(/^#/)) {
					return new ParserError("Unexpected text before #id",id);
				}
				// need to add the filename to the Define Tag ID
				else {
					id.val = id.filename + id.val;
				}
				delete id.filename;
			}
			else if (id.parent.type === NODE_TAG_EXTEND) {
				if (id.val.match(/^#/)) {
					return new ParserError("Expected template filename",id);
				}
				else if ((tmp = id.val.match(/(#.*?)([^a-z0-9_\-$.]).*$/i))) {
					return new ParserError("Unexpected token",new global.grips.tokenizer.Token({
						type: global.grips.tokenizer.GENERAL,
						val: tmp[2],
						pos: id.token.pos + tmp.index + tmp[1].length
					}));
				}
			}
			else if (id.parent.type === NODE_TAG_INCL_TMPL) {
				if (!id.val) {
					return new ParserError("Expected #id",id);
				}
				else if ((tmp = id.val.match(/(#.*?)([^a-z0-9_\-$.]).*$/i))) {
					return new ParserError("Unexpected token",new global.grips.tokenizer.Token({
						type: global.grips.tokenizer.GENERAL,
						val: tmp[2],
						pos: id.token.pos + tmp.index + tmp[1].length
					}));
				}
				// need to add the filename to the IncludeTemplate Tag ID
				else if (id.val.match(/^#/)) {
					id.val = id.filename + id.val;
				}
				delete id.filename;
			}
		}

		function validateSimpleExpr(expr) {
			var i, tmp, prev_node, prev_nonws_node, node, stack = [];
			if (expr.decl && expr.decl.length > 0) {
				for (i=0; i<expr.decl.length; i++) {
					prev_node = node;
					if (node && node.type !== WHITESPACE) {
						prev_nonws_node = node;
					}

					node = expr.decl[i];
					if (node.type === NODE_OPERATOR) {
						if (node.token.val.match(/^[\[\(]$/)) {
							if (node.token.val === "[" &&
								prev_nonws_node &&
								prev_nonws_node.type !== NODE_TEXT
							) {
								return new ParserError("Invalid EXPR",node.token);
							}
							stack.push(node.token.val);
						}
						else if (node.token.val.match(/^[\]\)]$/)) {
							if (stack.length > 0 &&
								stack[stack.length-1] === node.token.val
							) {
								stack.pop();
							}
							else {
								return new ParserError("Unbalanced EXPR",node.token);
							}
						}
					}
					else if (node.type === NODE_TEXT) {
						// TODO: what?
					}
				}
			}
			else {
				return new ParserError("Expected EXPR",expr);
			}
		}

		var ret, err, ret2;

		if (node.type === NODE_TAG_EXTEND) {
			if (!(node.id && (ret = parse(node.id)))) {
				throw new ParserError("Expected #id for Tag",node);
			}
			node.id = ret;

			// is there any non-whitespace left in the Tag declaration?
			if (node.decl && node.decl.length) {
				node.decl[0] = node.id;

				if (node.decl.length > 1) {
					for (var i=1; i<node.decl.length; i++) {
						if (node.decl[i].type !== NODE_WHITESPACE) {
							throw new ParserError("Unexpected",node.decl[i]);
						}
					}

					node.decl = [node.id];
				}
			}

			return node;
		}
		else if (node.type === NODE_TAG_DEFINE) {
			if (!(node.id && (ret = parse(node.id)))) {
				throw new ParserError("Expected #id for Tag",node);
			}
			node.id = ret;

			// do we need to parse the Tag's declaration?
			if (node.decl && node.decl.length) {
				ret = [node.id];
				for (var i=1; i<node.decl.length; i++) {
					// ignore a trailing whitespace node in the Tag declaration
					if (i === (node.decl.length - 1) &&
						node.decl[i].type === NODE_WHITESPACE
					) {
						break;
					}
					ret2 = parse(node.decl[i]);
					if (ret2) ret.push(ret2);
				}
				node.decl = ret;
			}

			// do we need to parse the Tag's children?
			if (node.children && node.children.length) {
				node.children = combineNodes(node.children);
				ret = [];
				for (var i=0; i<node.children.length; i++) {
					ret2 = parse(node.children[i]);
					if (ret2) ret.push(ret2);
				}
				node.children = ret;
			}

			return node;
		}
		else if (node.type === NODE_TAG_LOOP) {
			if (!(node.main_expr && (ret = parse(node.main_expr)))) {
				throw new ParserError("Expected EXPR for Tag",node);
			}
			node.main_expr = ret;

			// do we need to parse the Tag's declaration?
			if (node.decl && node.decl.length) {
				ret = [node.main_expr];
				for (var i=1; i<node.decl.length; i++) {
					// ignore a trailing whitespace node in the Tag declaration
					if (i === (node.decl.length - 1) &&
						node.decl[i].type === NODE_WHITESPACE
					) {
						break;
					}
					ret2 = parse(node.decl[i]);
					if (ret2) ret.push(ret2);
				}
				node.decl = ret;
			}

			// do we need to parse the Tag's children?
			if (node.children && node.children.length) {
				node.children = combineNodes(node.children);
				ret = [];
				for (var i=0; i<node.children.length; i++) {
					ret2 = parse(node.children[i]);
					if (ret2) ret.push(ret2);
				}
				node.children = ret;
			}

			return node;
		}
		else if (node.type === NODE_TAG_INCL_VAR) {
			if (!(node.main_expr && (ret = parse(node.main_expr)))) {
				throw new ParserError("Expected EXPR for Tag",node);
			}
			node.main_expr = ret;

			// is there any non-whitespace left in the Tag declaration?
			if (node.decl && node.decl.length) {
				node.decl[0] = node.main_expr;

				if (node.decl.length > 1) {
					for (var i=1; i<node.decl.length; i++) {
						if (node.decl[i].type !== NODE_WHITESPACE) {
							throw new ParserError("Unexpected",node.decl[i]);
						}
					}
				}
				
				node.decl = [node.main_expr];
			}

			return node;
		}
		else if (node.type === NODE_TAG_INCL_TMPL) {
			if (!(node.main_expr && (ret = parse(node.main_expr)))) {
				throw new ParserError("Expected EXPR for Tag",node);
			}
			node.main_expr = ret;

			// is there any non-whitespace left in the Tag declaration?
			if (node.decl && node.decl.length) {
				node.decl[0] = node.main_expr;

				if (node.decl.length > 1) {
					for (var i=1; i<node.decl.length; i++) {
						if (node.decl[i].type !== NODE_WHITESPACE) {
							throw new ParserError("Unexpected",node.decl[i]);
						}
					}
				}

				node.decl = [node.main_expr];
			}

			return node;
		}
		else if (node.type === NODE_TAG_RAW) {
			if (node.children && node.children.length > 0) {
				node.children = combineNodes(node.children);
			}

			return node;
		}
		else if (node.type === NODE_ID) {
			if ((err = validateTagID(node))) {
				throw err;
			}

			return node;
		}
		else if (node.type === NODE_EXPR) {
			if (node.decl && node.decl.length) {
				node.decl = combineWhitespaceNodes(node.decl);
				// do we have trailing whitespace to strip from the EXPR declaration?
				for (var i=node.decl.length-1; i>=0; i--) {
					if (node.decl[i].type !== NODE_WHITESPACE) {
						break;
					}
					else {
						node.decl.pop();
					}
				}
			}
			else {
				throw new ParserError("Unexpected",node);
			}

			return node;
		}
		else if (node.type === NODE_MAIN_EXPR) {
			if (node.decl && node.decl.length) {
				// remove all whitespace from a main expr
				ret = [];
				for (var i=0; i<node.decl.length; i++) {
					if (node.decl[i].type !== NODE_WHITESPACE) {
						ret.push(node.decl[i]);
					}
				}
				node.decl = ret;

				if ((err = validateSimpleExpr(node))) {
					throw err;
				}
			}
			else {
				throw new ParserError("Unexpected",node);
			}

			return node;
		}
		else if (node.type === NODE_LITERAL_EXPR) {
			// does this need any validation?
			return node;
		}
		else if (node.type === NODE_TEXT) {
			if (node.val !== "") {
				return node;
			}
		}
		else {
			return node;
		}
	}

	function parseNextNode() {
		var ret;
		// go until we find a node that parsed well, or we run out of nodes
		while (node_idx < nodes.length && !ret) {
			ret = parse(nodes[node_idx++]);
		}
		return ret;
	}


	var nodes = [],
		current_parent,
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
		NODE_TAG_INCL_VAR = 4,
		NODE_TAG_LOOP = 5,
		NODE_TAG_RAW = 6,
		NODE_TAG_COMMENT = 7,
		NODE_ID = 8,
		NODE_EXPR = 9,
		NODE_MAIN_EXPR = 10,
		NODE_LITERAL_EXPR = 11,
		NODE_WHITESPACE = 12,
		NODE_OPERATOR = 13,

		instance_api
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
		TAG_INCL_VAR: NODE_TAG_INCL_VAR,
		TAG_LOOP: NODE_TAG_LOOP,
		TAG_RAW: NODE_TAG_RAW,
		TAG_COMMENT: NODE_TAG_COMMENT,
		ID: NODE_ID,
		EXPR: NODE_EXPR,
		MAIN_EXPR: NODE_MAIN_EXPR,
		LITERAL_EXPR: NODE_LITERAL_EXPR,
		WHITESPACE: NODE_WHITESPACE,
		OPERATOR: NODE_OPERATOR,

		state: NODE_STATE_OUTSIDE,

		nodify: nodify,
		parseNextNode: parseNextNode,

		dump: function() { return nodes; },

		Node: Node,
		ParserError: ParserError
	};

	global.grips.parser = instance_api;

})(this);