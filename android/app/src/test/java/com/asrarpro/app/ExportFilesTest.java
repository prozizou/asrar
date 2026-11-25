package com.asrarpro.app;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

public class ExportFilesTest {
    @Test public void keepsOrdinaryNames() {
        assertEquals("Ecriture spirituelle.docx", ExportFiles.safeName("Ecriture spirituelle.docx", "document"));
        assertEquals("حرز.pdf", ExportFiles.safeName("حرز.pdf", "document"));
    }

    @Test public void replacesPathSeparatorsAndReservedCharacters() {
        assertEquals("a-b-c.docx", ExportFiles.safeName("a/b\\c.docx", "document"));
        assertEquals("a-b.pdf", ExportFiles.safeName("a\nb.pdf", "document"));
        assertEquals("q-r.pdf", ExportFiles.safeName("q?r.pdf", "document"));
    }

    @Test public void neverReturnsAPathOrHiddenName() {
        String name = ExportFiles.safeName("../../secret", "document");
        assertFalse(name.contains("/"));
        assertFalse(name.startsWith("."));
        assertEquals("document", ExportFiles.safeName("...", "document"));
    }

    @Test public void usesFallbackWhenEmpty() {
        assertEquals("document", ExportFiles.safeName(null, "document"));
        assertEquals("document", ExportFiles.safeName("   ", "document"));
    }

    @Test public void shortensLongNamesButKeepsTheExtension() {
        StringBuilder long200 = new StringBuilder();
        for (int i = 0; i < 200; i++) long200.append('a');
        String name = ExportFiles.safeName(long200 + ".docx", "document");
        assertTrue(name.length() <= 120);
        assertTrue(name.endsWith(".docx"));
    }
}
