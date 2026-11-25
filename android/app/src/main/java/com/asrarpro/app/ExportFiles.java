package com.asrarpro.app;

/** Noms de fichiers sûrs pour les exports (Word, PDF) : ni chemin ni caractère réservé. */
final class ExportFiles {
    private static final int MAX_LENGTH = 120;

    private ExportFiles() {}

    static String safeName(String raw, String fallback) {
        String name = raw == null ? "" : raw.replaceAll("[\\\\/:*?\"<>|\\p{Cntrl}]+", "-").trim();
        name = name.replaceAll("^\\.+", "").trim();
        if (name.length() > MAX_LENGTH) {
            int dot = name.lastIndexOf('.');
            String extension = dot > 0 && name.length() - dot <= 8 ? name.substring(dot) : "";
            name = name.substring(0, MAX_LENGTH - extension.length()) + extension;
        }
        return name.isEmpty() ? fallback : name;
    }
}
