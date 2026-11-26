package com.asrarpro.app;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

public class PreloadedSlotTest {
    private static final long TTL = 1000;

    @Test public void startsEmptyAndAllowsAFirstLoad() {
        PreloadedSlot<String> slot = new PreloadedSlot<>(TTL);
        assertFalse(slot.ready(0));
        assertTrue(slot.tryStartLoad(0) > 0);
    }

    @Test public void onlyOneLoadAtATime() {
        PreloadedSlot<String> slot = new PreloadedSlot<>(TTL);
        slot.tryStartLoad(0);
        assertEquals(0, slot.tryStartLoad(1));
    }

    @Test public void loadedAdIsReadyThenTakenOnce() {
        PreloadedSlot<String> slot = new PreloadedSlot<>(TTL);
        int token = slot.tryStartLoad(0);
        assertTrue(slot.loaded(token, "ad", 10));
        assertTrue(slot.ready(500));
        assertEquals("ad", slot.take(500));
        assertNull(slot.take(501));
        assertFalse(slot.ready(502));
    }

    @Test public void readyAdBlocksANewLoad() {
        PreloadedSlot<String> slot = new PreloadedSlot<>(TTL);
        slot.loaded(slot.tryStartLoad(0), "ad", 0);
        assertEquals(0, slot.tryStartLoad(100));
    }

    @Test public void expiredAdIsDroppedAndReplaced() {
        PreloadedSlot<String> slot = new PreloadedSlot<>(TTL);
        slot.loaded(slot.tryStartLoad(0), "ad", 0);
        assertFalse(slot.ready(TTL));
        assertNull(slot.take(TTL));
        assertTrue(slot.tryStartLoad(TTL + 1) > 0);
    }

    @Test public void failureWaitsBeforeTheNextRequestAndTheDelayGrows() {
        PreloadedSlot<String> slot = new PreloadedSlot<>(TTL);
        int token = slot.tryStartLoad(0);
        slot.failed(token, 0);
        assertEquals(PreloadedSlot.FIRST_RETRY_MS, slot.retryDelayMs());
        assertEquals(0, slot.tryStartLoad(PreloadedSlot.FIRST_RETRY_MS - 1));
        int second = slot.tryStartLoad(PreloadedSlot.FIRST_RETRY_MS);
        assertTrue(second > 0);
        slot.failed(second, PreloadedSlot.FIRST_RETRY_MS);
        assertEquals(2 * PreloadedSlot.FIRST_RETRY_MS, slot.retryDelayMs());
    }

    @Test public void retryDelayIsCapped() {
        PreloadedSlot<String> slot = new PreloadedSlot<>(TTL);
        long now = 0;
        for (int i = 0; i < 20; i++) {
            int token = slot.tryStartLoad(now);
            slot.failed(token, now);
            now += PreloadedSlot.MAX_RETRY_MS;
        }
        assertEquals(PreloadedSlot.MAX_RETRY_MS, slot.retryDelayMs());
    }

    @Test public void successResetsTheFailureDelay() {
        PreloadedSlot<String> slot = new PreloadedSlot<>(TTL);
        slot.failed(slot.tryStartLoad(0), 0);
        slot.loaded(slot.tryStartLoad(PreloadedSlot.FIRST_RETRY_MS), "ad", PreloadedSlot.FIRST_RETRY_MS);
        assertEquals(0, slot.retryDelayMs());
    }

    @Test public void clearingIgnoresAnInFlightResult() {
        PreloadedSlot<String> slot = new PreloadedSlot<>(TTL);
        int token = slot.tryStartLoad(0);
        slot.clear();
        assertFalse(slot.loaded(token, "late", 5));
        assertFalse(slot.ready(5));
        assertTrue(slot.tryStartLoad(6) > 0);
    }
}
