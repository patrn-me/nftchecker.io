<?php
set_time_limit(90);

http_response_code(500);
$url = trim($_SERVER['QUERY_STRING']);
if (!$url) {
	echo 'Expected URL';
	die;
}

$parts = parse_url($url);
switch ($parts['scheme'] ?? false) {
	case 'http':
	case 'https': break;
	default: {
		echo 'Invalid URL: ', $url;
		die;
	}
}
$fp = @fopen($url, 'rb');
if ($fp === false) {
	http_response_code(404);
	echo 'File Not Found: ', $url;
	die;
}
http_response_code(200);
foreach ($http_response_header as $s) {
	$pos = strpos($s, ':');
	if ($pos === false) continue;
	$key = strtolower(trim(substr($s, 0, $pos)));
	if ($key === 'content-type' || $key === 'content-length') {
		header($s, true);
	}
}
fpassthru($fp);
fclose($fp);
?>