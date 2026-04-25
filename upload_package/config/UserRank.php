<?php

class UserRank
{
    const OBSERVER = 'Observer';
    const SPECIALIST = 'Specialist';
    const ANALYST = 'Analyst';
    const ADMIN = 'Admin';

    public static function getAll()
    {
        return [
            self::OBSERVER,
            self::SPECIALIST,
            self::ANALYST,
            self::ADMIN
        ];
    }
}
