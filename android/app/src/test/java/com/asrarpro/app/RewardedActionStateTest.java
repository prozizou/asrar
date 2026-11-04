package com.asrarpro.app;

import org.junit.Test;
import static org.junit.Assert.*;

public class RewardedActionStateTest {
    @Test public void closingWithoutRewardNeverUnlocks() {
        RewardedActionState state = new RewardedActionState();
        state.displayed(); state.closed();
        assertTrue(state.wasDisplayed()); assertFalse(state.isComplete());
    }
    @Test public void rewardWithoutDisplayNeverUnlocks() {
        RewardedActionState state = new RewardedActionState();
        state.rewarded(); state.closed();
        assertFalse(state.isComplete());
    }
    @Test public void waitsForCloseBeforeUnlocking() {
        RewardedActionState state = new RewardedActionState();
        state.displayed(); state.rewarded();
        assertFalse(state.isComplete());
        state.closed(); assertTrue(state.isComplete());
    }
    @Test public void supportsRewardAfterCloseAndDuplicateCallbacks() {
        RewardedActionState state = new RewardedActionState();
        state.displayed(); state.closed(); state.rewarded(); state.rewarded();
        assertTrue(state.isComplete());
        assertFalse(new RewardedActionState().isComplete());
    }
}
