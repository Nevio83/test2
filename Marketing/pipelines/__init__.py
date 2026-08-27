"""Marketing-Pipelines.

AUSGABE-KODIERUNG — nicht kosmetisch, sondern ein echter Absturzgrund.

Dieses Projekt nutzt projektweit Emoji in Protokollzeilen (✅/⚠️/❌, siehe
CLAUDE.md Paragraph 8). Unter Windows steht die Konsole aber standardmaessig
auf cp1252, und dort ist "⏭️" schlicht nicht darstellbar: print() wirft dann
UnicodeEncodeError und reisst den kompletten Lauf mit.

Genau das ist beim ersten Testlauf am 14.08.2026 passiert — nicht in einem
Randfall, sondern in der Statusausgabe. In GitHub Actions faellt es nicht auf
(dort ist die Ausgabe UTF-8), auf dem eigenen PC dagegen sofort. Ein Fehler,
der nur an einem der drei Betriebsorte auftritt, ist der unangenehmste: er
sieht nach "geht bei mir" aus.

errors="replace" statt "strict": Lieber ein Ersatzzeichen in einer
Protokollzeile als ein abgebrochener Lauf.
"""

from __future__ import annotations

import sys


def _ausgabe_auf_utf8() -> None:
    for strom in (sys.stdout, sys.stderr):
        try:
            strom.reconfigure(encoding="utf-8", errors="replace")  # type: ignore[union-attr]
        except (AttributeError, ValueError):  # pragma: no cover
            # Umgeleitete Stroeme (Pipes, Tests) koennen das nicht — dann
            # bleibt es beim Standard. Kein Grund abzubrechen.
            pass


_ausgabe_auf_utf8()
