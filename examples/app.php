<?php

$input = array();
$output = array();
if (isset($_REQUEST["data"])) {
	$input = json_decode($_REQUEST["data"]);
}

// either login or logout, so only send partial data
if (isset($input["user_id"])) {
	// logging in with a real user-id
	if ($data["user_id"]) {
		$output = array(
			"APP_STATE" => "index_content_partial", 	// from templates.json
			"APP_DATA" => array(
				"user_id" => (int)($input["user_id"]),
				"full_name" => "John Doe",
				"info" => "You're awesome at air hockey!",
				"links" => array(
					"http://awesome.com",
					"http://airhockey.com",
					"http://supercool.com"
				)
			)
		);
	}
	else { // logging out
		$output = array(
			"APP_STATE" => "index_content_partial", 	// from templates.json
			"APP_DATA" => array()
		);
	}
}
else { // initial request, just render the content portion of the page
	$output = array(
		"APP_STATE" => "index_content", 	// from templates.json
		"APP_DATA" => array()
	);
}

return json_encode($output);

?>