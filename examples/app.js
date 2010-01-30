function login() {
	Handlebar.DataClient.get("app.php",{user_id:1},function(data){
		Handlebar.processState(data.APP_STATE,data.APP_DATA,function(content){
			detachControlsBehavior();
			$("#userdetails").html(content);
			attachControlsBehavior();
		});
	});
}

function logout() {
	Handlebar.DataClient.get("app.php",{user_id:0},function(data){
		Handlebar.processState(data.APP_STATE,data.APP_DATA,function(content){
			detachControlsBehavior();
			$("#userdetails").html(content);
			attachControlsBehavior();
		});
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
	Handlebar.DataClient.get("app.php",{},function(data){
		Handlebar.processState(data.APP_STATE,data.APP_DATA,function(content){
			$("#content").html(content);
			attachControlsBehavior();
		});
	});
}
