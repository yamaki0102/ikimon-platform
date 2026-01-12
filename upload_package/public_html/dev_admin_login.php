<?php
require_once __DIR__ . '/../libs/Auth.php';
Auth::init();

// Login as Dr. Ikimon (Admin)
Auth::login([
    'id' => 'admin_001',
    'name' => 'Dr. Ikimon',
    'avatar' => 'assets/images/dr_ikimon.png',
    'rank' => 'Admin'
]);

header('Location: admin/index.php');
exit;
