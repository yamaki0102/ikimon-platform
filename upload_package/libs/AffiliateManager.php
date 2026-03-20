<?php

/**
 * Temporary compatibility shim.
 *
 * observation_detail.php references AffiliateManager for optional affiliate
 * book suggestions, but the real implementation is absent in this tree.
 * Returning no recommendations keeps the page functional without affecting the
 * observation data itself.
 */
class AffiliateManager
{
    public static function getBooks($taxon = null, $context = null): array
    {
        return [];
    }
}
