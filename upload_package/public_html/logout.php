<?php
require_once __DIR__ . '/../libs/Auth.php';

Auth::logout();
header('Location: login.php');
exit;
