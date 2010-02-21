function login() {
	Handlebar.DataClient.get("app.php",{user_id:1})
	.then(function(P){
		var data = P.value;
		return Handlebar.processState(data.APP_STATE,data.APP_DATA)
	})
	.then(function(P){
		var content = P.value;
		detachControlsBehavior();
		$("#userdetails").html(content);
		attachControlsBehavior();
	});
}

function logout() {
	Handlebar.DataClient.get("app.php",{user_id:0})
	.then(function(P){
		var data = P.value;
		return Handlebar.processState(data.APP_STATE,data.APP_DATA)
	})
	.then(function(P){
		var content = P.value;
		detachControlsBehavior();
		$("#userdetails").html(content);
		attachControlsBehavior();
	});
}

function attachControlsBehavior() {
	$(".controls").click(function(evt){
		if ($(this).hasClass("login")) login();
		else if ($(this).hasClass("logout")) logout();
		
		evt.preventDefault();
		return false;
	});
}

function detachControlsBehavior() {
	$(".controls").unbind("click");
}

function buildPage() {
	Handlebar.DataClient.get("app.php",{})
	.then(function(P){
		var data = P.value;
		return Handlebar.processState(data.APP_STATE,data.APP_DATA)
	})
	.then(function(P){
		var content = P.value;
		$("#content").html(content);
		attachControlsBehavior();
	});
}
