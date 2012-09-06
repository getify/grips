(function(global){

	function process() {
		function startFilemarker(node) {
			return "(function(__filename__){";
		}

		function closeFilemarker(node) {
			return "})(\"" + node.close + "\");"
		}

		function tag_Extend(node) {
			return "global.grips.extend(__filename__,\"" + node.id + "\");";
		}

		function tag_Define(node) {
			var _code = "";
			_code += "global.grips.define(\"" + node.id.val + "\",function(data){";
			_code += "});";
			return _code;
		}


		var node, nodes = [], code = "";

		while ((node = global.grips.parser.parseNextNode())) {
			nodes.push(node);

			if (node.type === global.grips.parser.FILEMARKER) {
				if (node.start) {
					code += startFilemarker(node);
				}
				else if (node.close) {
					code += closeFilemarker(node);
				}
			}
			else if (node.type === global.grips.parser.TAG_EXTEND) {
				if (!(
						nodes.length > 1 &&
						nodes[nodes.length - 2].type === global.grips.parser.FILEMARKER
					)
				) {
					throw new global.grips.parser.ParserError("Unexpected Tag",node);
				}
				code += tag_Extend(node);
			}
			else if (node.type === global.grips.parser.TAG_DEFINE) {
				code += tag_Define(node);
			}
		}

		return code;
	}

	var instance_api;

	instance_api = {
		process: process
	};

	global.grips.generator = instance_api;

})(this);