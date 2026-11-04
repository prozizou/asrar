package com.asrarpro.app;

/** Neither closing nor displaying an ad alone proves a completed reward. */
final class RewardedActionState {
    private boolean displayed;
    private boolean rewarded;
    private boolean closed;
    void displayed() { displayed = true; }
    void rewarded() { rewarded = true; }
    void closed() { closed = true; }
    boolean wasDisplayed() { return displayed; }
    boolean isClosed() { return closed; }
    boolean isComplete() { return displayed && rewarded && closed; }
}
