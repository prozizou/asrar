package com.asrarpro.app;

import static org.junit.Assert.assertArrayEquals;
import static org.junit.Assert.assertEquals;

import java.util.ArrayList;
import java.util.List;
import org.junit.Test;

public class AdUnitChainTest {
    @Test public void productionTriesHighThenDefault() {
        assertArrayEquals(new String[] {
            "ca-app-pub-3895250961868134/2847200667", "ca-app-pub-3895250961868134/9551701662" },
            AdUnitChain.units(AdUnitChain.REWARDED, false));
    }

    @Test public void debugUsesOnlyGoogleDemoUnit() {
        assertArrayEquals(new String[] { "ca-app-pub-3940256099942544/1033173712" },
            AdUnitChain.units(AdUnitChain.INTERSTITIAL, true));
    }

    @Test public void stopsAtFirstFilledUnit() {
        List<String> tried = new ArrayList<>();
        int[] exhausted = { 0 };
        AdUnitChain.run(new String[] { "high", "default" }, (unit, next) -> tried.add(unit), () -> exhausted[0]++);
        assertEquals(List.of("high"), tried);
        assertEquals(0, exhausted[0]);
    }

    @Test public void fallsBackThenReportsNoFill() {
        List<String> tried = new ArrayList<>();
        int[] exhausted = { 0 };
        AdUnitChain.run(new String[] { "high", "default" }, (unit, next) -> { tried.add(unit); next.run(); next.run(); }, () -> exhausted[0]++);
        assertEquals(List.of("high", "default"), tried);
        assertEquals(1, exhausted[0]);
    }
}
