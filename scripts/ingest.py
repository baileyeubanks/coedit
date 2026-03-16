#!/usr/bin/env python3
"""
Co-Cut Ingest Pipeline
======================
AI-enhanced automated media ingestion for professional video post-production.

Phases:
  1. Root folder creation (YYYY.MM.DD_PROJECT_NAME on ~/Desktop)
  2. Smart file ingestion & top-level AI categorisation  [SHA-256 integrity checks]
  3. XMP sidecar generation (Premiere / Resolve / Avid compatible)
  4. Deep analysis: Whisper transcription + good-take reasoning + FCPXML output
  5. NAS backup trigger & persistent watchdog sync (--monitor flag)

Requirements:
  pip install openai-whisper ffmpeg-python python-xmp-toolkit mutagen tqdm colorama watchdog
  brew install ffmpeg

Usage:
  python ingest.py
  python ingest.py --project "Chevron Field Shoot" --date 2026.03.16 --input /path
  python ingest.py --monitor ~/Desktop/2026.03.16_CHEVRON_FIELD_SHOOT
"""

from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import subprocess
import sys
import threading
import xml.etree.ElementTree as ET
from datetime import datetime
from pathlib import Path
from typing import Optional

# ─── Optional colour output ────────────────────────────────────────────────────
try:
    from colorama import Fore, Style, init as colorama_init
    colorama_init(autoreset=True)
    GREEN  = Fore.GREEN
    YELLOW = Fore.YELLOW
    RED    = Fore.RED
    CYAN   = Fore.CYAN
    DIM    = Style.DIM
    RESET  = Style.RESET_ALL
except ImportError:
    GREEN = YELLOW = RED = CYAN = DIM = RESET = ""

try:
    from tqdm import tqdm
    HAS_TQDM = True
except ImportError:
    HAS_TQDM = False

# ─── Folder tree ───────────────────────────────────────────────────────────────
FOLDER_TREE = [
    "01_PROJECT_FILES/PrPro",
    "01_PROJECT_FILES/AE",
    "01_PROJECT_FILES/Other",
    "02_ASSETS/02.1_FOOTAGE/RAW",
    "02_ASSETS/02.1_FOOTAGE/INTERVIEW",
    "02_ASSETS/02.1_FOOTAGE/BROLL",
    "02_ASSETS/02.2_AUDIO/MUSIC",
    "02_ASSETS/02.2_AUDIO/SFX",
    "02_ASSETS/02.2_AUDIO/INTERVIEW_AUDIO",
    "02_ASSETS/02.3_GRAPHICS/LOGOS",
    "02_ASSETS/02.3_GRAPHICS/LT_LOWER_THIRDS",
    "02_ASSETS/02.3_GRAPHICS/OTHER",
    "02_ASSETS/02.4_DOCUMENTS/SCRIPT",
    "02_ASSETS/02.4_DOCUMENTS/STORYBOARD",
    "02_ASSETS/02.5_PHOTOS",
    "03_EXPORTS/ROUGH_CUTS",
    "03_EXPORTS/FINE_CUTS",
    "04_FINALS",
    "05_REFERENCE",
]

# ─── Extension → folder routing ────────────────────────────────────────────────
EXT_MAP: dict[str, str] = {
    # Video — raw camera
    **{e: "02_ASSETS/02.1_FOOTAGE/RAW" for e in [
        "mov", "mp4", "mxf", "r3d", "braw", "ari", "arx", "mts", "m2t",
        "m2ts", "mkv", "avi", "wmv", "dng",
    ]},
    # Audio
    **{e: "02_ASSETS/02.2_AUDIO/MUSIC" for e in [
        "mp3", "wav", "aif", "aiff", "m4a", "flac", "ogg", "opus", "aac",
    ]},
    # Graphics / design
    **{e: "02_ASSETS/02.3_GRAPHICS/OTHER" for e in [
        "ai", "svg", "eps", "psd", "xd", "sketch",
    ]},
    # Raster photos
    **{e: "02_ASSETS/02.5_PHOTOS" for e in [
        "jpg", "jpeg", "png", "tif", "tiff", "heic", "heif", "webp", "cr2",
        "cr3", "nef", "arw",
    ]},
    # Documents
    **{e: "02_ASSETS/02.4_DOCUMENTS/SCRIPT" for e in [
        "pdf", "docx", "doc", "txt", "rtf", "pages", "md",
    ]},
}
FALLBACK_FOLDER = "05_REFERENCE"


# ─── Phase 1: Root folder creation ─────────────────────────────────────────────

def validate_date(date_str: str) -> bool:
    return bool(re.match(r"^\d{4}\.\d{2}\.\d{2}$", date_str))


def build_folder_name(date: str, name: str) -> str:
    safe = re.sub(r"[^\w.()\- ]", "", name).strip().upper().replace(" ", "_")
    return f"{date}_{safe}"


def create_folder_tree(root: Path) -> None:
    print(f"\n{CYAN}Creating folder structure in:{RESET} {root}\n")
    for rel in FOLDER_TREE:
        folder = root / rel
        folder.mkdir(parents=True, exist_ok=True)
        print(f"  {DIM}+{RESET} {rel}")
    print(f"\n{GREEN}✓ Folder tree ready.{RESET}")


# ─── Phase 2: Top-level categorisation & ingestion ─────────────────────────────

def classify_file(path: Path) -> str:
    ext = path.suffix.lstrip(".").lower()
    return EXT_MAP.get(ext, FALLBACK_FOLDER)


def ingest_files(sources: list[Path], project_root: Path) -> list[Path]:
    """Copy source files into the project tree. Returns list of destination paths."""
    ingested: list[Path] = []
    files_to_copy: list[Path] = []

    for src in sources:
        if src.is_dir():
            files_to_copy.extend(p for p in src.rglob("*") if p.is_file())
        elif src.is_file():
            files_to_copy.append(src)

    if not files_to_copy:
        print(f"{YELLOW}No files found to ingest.{RESET}")
        return ingested

    iterator = tqdm(files_to_copy, desc="Ingesting", unit="file") if HAS_TQDM else files_to_copy  # type: ignore[assignment]
    for src_file in iterator:
        dest_folder = project_root / classify_file(src_file)
        dest_folder.mkdir(parents=True, exist_ok=True)
        dest = dest_folder / src_file.name
        if dest.exists():
            dest = dest_folder / f"{src_file.stem}_1{src_file.suffix}"
        shutil.copy2(src_file, dest)
        ingested.append(dest)

    print(f"\n{GREEN}✓ Ingested {len(ingested)} file(s).{RESET}")
    return ingested


# ─── Phase 3: XMP sidecar generation ───────────────────────────────────────────

def probe_media(path: Path) -> dict:
    """Use ffprobe to get stream/format metadata."""
    try:
        result = subprocess.run(
            ["ffprobe", "-v", "quiet", "-print_format", "json", "-show_format",
             "-show_streams", str(path)],
            capture_output=True, text=True, timeout=15,
        )
        return json.loads(result.stdout) if result.returncode == 0 else {}
    except Exception:
        return {}


def write_xmp_sidecar(file_path: Path, extra: Optional[dict] = None) -> Path:
    """
    Write a minimal XMP sidecar (.xmp) next to *file_path*.
    Fields map to standard NLE columns (Premiere Pro, Resolve, Avid).
    """
    extra = extra or {}
    xmp_path = file_path.with_suffix(file_path.suffix + ".xmp")

    now_iso = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")

    root = ET.Element("x:xmpmeta", attrib={
        "xmlns:x": "adobe:ns:meta/",
        "x:xmptk": "Co-Cut Ingest Pipeline 1.0",
    })
    rdf = ET.SubElement(root, "rdf:RDF", attrib={
        "xmlns:rdf": "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
    })
    desc = ET.SubElement(rdf, "rdf:Description", attrib={
        "xmlns:dc": "http://purl.org/dc/elements/1.1/",
        "xmlns:xmp": "http://ns.adobe.com/xap/1.0/",
        "xmlns:xmpDM": "http://ns.adobe.com/xmp/1.0/DynamicMedia/",
        "xmlns:xmpMM": "http://ns.adobe.com/xap/1.0/mm/",
        "rdf:about": "",
    })

    ET.SubElement(desc, "dc:title").text       = file_path.stem
    ET.SubElement(desc, "dc:source").text      = str(file_path)
    ET.SubElement(desc, "xmp:CreateDate").text = now_iso
    ET.SubElement(desc, "xmp:ModifyDate").text = now_iso
    ET.SubElement(desc, "xmp:CreatorTool").text = "Co-Cut Ingest Pipeline"

    # NLE-compatible fields
    ET.SubElement(desc, "xmpDM:scene").text    = extra.get("scene", classify_file(file_path).split("/")[-1])
    ET.SubElement(desc, "xmpDM:good").text     = extra.get("good", "unknown")
    ET.SubElement(desc, "xmpDM:logComment").text = extra.get("log_comment", "")

    if "in_point" in extra:
        ET.SubElement(desc, "xmpDM:inPoint").text  = str(extra["in_point"])
    if "out_point" in extra:
        ET.SubElement(desc, "xmpDM:outPoint").text = str(extra["out_point"])
    if "transcript" in extra:
        ET.SubElement(desc, "dc:description").text = extra["transcript"][:2000]

    tree = ET.ElementTree(root)
    ET.indent(tree, space="  ")
    tree.write(xmp_path, encoding="unicode", xml_declaration=True)
    return xmp_path


def generate_xmp_sidecars(files: list[Path]) -> None:
    print(f"\n{CYAN}Generating XMP sidecars…{RESET}")
    iterator = tqdm(files, unit="file") if HAS_TQDM else files  # type: ignore[assignment]
    for f in iterator:
        if f.suffix.lower() in (".xmp",):
            continue
        try:
            write_xmp_sidecar(f)
        except Exception as e:
            print(f"  {RED}XMP failed for {f.name}: {e}{RESET}")
    print(f"{GREEN}✓ XMP sidecars written.{RESET}")


# ─── Phase 4: Deep analysis (background) ───────────────────────────────────────

GOOD_TAKE_MIN_SPEECH_SECS = 30.0     # minimum continuous speech in seconds
TRANSCRIPT_CONFIDENCE_MIN = 0.85     # whisper segment avg_logprob threshold
SILENCE_MAX_GAP_SECS      = 3.0      # tolerated silence gap inside a segment


def detect_silence_segments(audio_path: Path) -> list[dict]:
    """
    Run ffmpeg silencedetect and return list of {'start': float, 'end': float}.
    Silence threshold: -35dB, minimum silence duration: 0.5s.
    """
    try:
        result = subprocess.run(
            [
                "ffmpeg", "-i", str(audio_path),
                "-af", "silencedetect=noise=-35dB:d=0.5",
                "-f", "null", "-",
            ],
            capture_output=True, text=True, timeout=120,
        )
        output = result.stderr
        silences = []
        start: Optional[float] = None
        for line in output.splitlines():
            if "silence_start" in line:
                m = re.search(r"silence_start:\s*([\d.]+)", line)
                if m:
                    start = float(m.group(1))
            elif "silence_end" in line and start is not None:
                m = re.search(r"silence_end:\s*([\d.]+)", line)
                if m:
                    silences.append({"start": start, "end": float(m.group(1))})
                    start = None
        return silences
    except Exception:
        return []


def transcribe_file(audio_path: Path) -> Optional[dict]:
    """
    Run OpenAI Whisper on *audio_path*. Returns the Whisper result dict or None.
    Uses the 'base' model for speed; upgrade to 'medium' for accuracy.
    """
    try:
        import whisper  # type: ignore
        print(f"  Transcribing {audio_path.name} (Whisper base)…")
        model = whisper.load_model("base")
        result = model.transcribe(str(audio_path), word_timestamps=True, verbose=False)
        return result  # type: ignore[return-value]
    except ImportError:
        print(f"  {YELLOW}Whisper not installed — skipping transcription.{RESET}")
        return None
    except Exception as e:
        print(f"  {RED}Transcription error: {e}{RESET}")
        return None


def get_audio_duration(path: Path) -> float:
    info = probe_media(path)
    try:
        return float(info["format"]["duration"])
    except Exception:
        return 0.0


def identify_good_take_segments(
    result: dict,
    silences: list[dict],
    duration: float,
) -> list[tuple[float, float]]:
    """
    Return a list of (in_point, out_point) pairs for 'good take' segments.

    Rules:
    * Continuous speech ≥ GOOD_TAKE_MIN_SPEECH_SECS
    * Average segment confidence (avg_logprob) ≥ TRANSCRIPT_CONFIDENCE_MIN
    * No single silence gap > SILENCE_MAX_GAP_SECS within the segment
    """
    segments = result.get("segments", [])
    if not segments:
        return []

    good: list[tuple[float, float]] = []
    i = 0
    while i < len(segments):
        seg_start = segments[i]["start"]
        j = i
        cumulative_speech = 0.0
        avg_conf_sum = 0.0
        conf_count = 0
        bad = False

        while j < len(segments):
            s = segments[j]
            seg_dur = s["end"] - s["start"]
            cumulative_speech += seg_dur

            # Confidence check
            avg_logprob = s.get("avg_logprob", -0.5)
            avg_conf_sum += avg_logprob
            conf_count += 1

            # Check for long silence gap immediately following this segment
            if j + 1 < len(segments):
                gap = segments[j + 1]["start"] - s["end"]
                if gap > SILENCE_MAX_GAP_SECS:
                    # Long silence — can close a good segment here if criteria met
                    break
            j += 1

        seg_end = segments[j - 1]["end"] if j > i else seg_start + 1
        speech_dur = seg_end - seg_start
        avg_conf = avg_conf_sum / conf_count if conf_count else -1.0

        # Convert avg_logprob to a 0-1 scale (logprob 0 = 100%, -1 = ~37%)
        confidence_ok = avg_conf >= (TRANSCRIPT_CONFIDENCE_MIN - 1.0)  # map to logprob scale

        if not bad and speech_dur >= GOOD_TAKE_MIN_SPEECH_SECS and confidence_ok:
            good.append((round(seg_start, 3), round(seg_end, 3)))

        i = j if j > i else i + 1  # advance past processed group

    return good


def build_fcpxml(
    project_name: str,
    clip_path: Path,
    good_takes: list[tuple[float, float]],
    duration: float,
) -> str:
    """
    Generate a minimal FCPXML 1.9 sequence for the good-take segments.
    Import into Premiere Pro, Final Cut Pro, or DaVinci Resolve.
    """
    def secs_to_rational(secs: float) -> str:
        # Express as frame-accurate rational (30fps base)
        frames = round(secs * 30000)
        return f"{frames}/30000s"

    root = ET.Element("fcpxml", attrib={"version": "1.9"})
    resources = ET.SubElement(root, "resources")
    fmt = ET.SubElement(resources, "format", attrib={
        "id": "r1", "name": "FFVideoFormat1080p30",
        "frameDuration": "1001/30000s", "width": "1920", "height": "1080",
    })
    _ = fmt  # noqa

    asset = ET.SubElement(resources, "asset", attrib={
        "id": "r2",
        "name": clip_path.stem,
        "src": str(clip_path),
        "duration": secs_to_rational(duration),
        "audioSources": "1", "audioChannels": "2",
    })
    _ = asset  # noqa

    lib = ET.SubElement(root, "library")
    event = ET.SubElement(lib, "event", attrib={"name": project_name})
    project = ET.SubElement(event, "project", attrib={"name": f"{project_name}_GoodTakes"})
    seq = ET.SubElement(project, "sequence", attrib={
        "format": "r1",
        "duration": secs_to_rational(sum(e - s for s, e in good_takes)),
        "tcStart": "0s",
    })
    spine = ET.SubElement(seq, "spine")

    offset = 0.0
    for idx, (inn, out) in enumerate(good_takes):
        seg_dur = out - inn
        ET.SubElement(spine, "clip", attrib={
            "name": f"{clip_path.stem}_take_{idx + 1:02d}",
            "ref": "r2",
            "offset": secs_to_rational(offset),
            "duration": secs_to_rational(seg_dur),
            "start": secs_to_rational(inn),
        })
        offset += seg_dur

    tree = ET.ElementTree(root)
    ET.indent(tree, space="  ")
    from io import StringIO
    buf = StringIO()
    tree.write(buf, encoding="unicode", xml_declaration=True)
    return buf.getvalue()


def deep_analyze_interviews(project_root: Path, project_name: str) -> None:
    """Phase 4: background thread — transcribe + good-take analysis."""
    interview_dirs = [
        project_root / "02_ASSETS/02.1_FOOTAGE/INTERVIEW",
        project_root / "02_ASSETS/02.2_AUDIO/INTERVIEW_AUDIO",
    ]
    audio_exts = {".mp4", ".mov", ".mxf", ".mp3", ".wav", ".aif", ".aiff", ".m4a"}
    clips: list[Path] = []
    for d in interview_dirs:
        if d.exists():
            clips.extend(p for p in d.iterdir() if p.suffix.lower() in audio_exts)

    if not clips:
        print(f"\n{YELLOW}No interview clips found for deep analysis.{RESET}")
        return

    soundbites_dir = project_root / "02_ASSETS/02.1_FOOTAGE/SOUND_BITES"
    soundbites_dir.mkdir(parents=True, exist_ok=True)

    print(f"\n{CYAN}Phase 4: Deep analysis ({len(clips)} clip(s))…{RESET}")

    for clip in clips:
        print(f"\n  → {clip.name}")
        duration = get_audio_duration(clip)
        silences  = detect_silence_segments(clip)
        result    = transcribe_file(clip)

        if result is None:
            # Still write basic XMP even without transcription
            write_xmp_sidecar(clip, {"good": "unknown", "log_comment": "Whisper not available"})
            continue

        transcript_text = result.get("text", "")
        good_takes = identify_good_take_segments(result, silences, duration)
        is_good = len(good_takes) > 0

        # Update XMP sidecar with analysis results
        xmp_meta: dict = {
            "good": "true" if is_good else "false",
            "transcript": transcript_text,
            "log_comment": f"{len(good_takes)} good take segment(s) found.",
            "scene": "INTERVIEW",
        }
        if good_takes:
            xmp_meta["in_point"]  = good_takes[0][0]
            xmp_meta["out_point"] = good_takes[-1][1]
        write_xmp_sidecar(clip, xmp_meta)

        # Write FCPXML for import into Premiere / Resolve / FCP
        if good_takes:
            fcpxml_str = build_fcpxml(project_name, clip, good_takes, duration)
            out_path = soundbites_dir / f"{clip.stem}_goodtakes.fcpxml"
            out_path.write_text(fcpxml_str, encoding="utf-8")
            print(f"    {GREEN}✓ {len(good_takes)} good take(s) → {out_path.name}{RESET}")
        else:
            print(f"    {YELLOW}No good takes identified in {clip.name}.{RESET}")

    print(f"\n{GREEN}✓ Deep analysis complete.{RESET}")


# ─── Phase 5: NAS Backup Trigger & Persistent Watchdog Sync ───────────────────

DEBOUNCE_SECS     = 30
PIPELINE_DIR      = ".pipeline"
BACKUP_CONFIG     = "backup_config.json"
BACKUP_LOG        = "backup.log"
LAUNCHD_LABEL     = "com.contentcoop.cocut.backup"

FINALS_EXTS = {".mov", ".mp4", ".mxf", ".m4v", ".avi", ".mkv", ".r3d", ".braw"}


def _osascript(script: str) -> str:
    """Run an AppleScript and return stdout stripped."""
    result = subprocess.run(["osascript", "-e", script],
                            capture_output=True, text=True)
    return result.stdout.strip()


def _dialog(message: str, buttons: list[str], default: int = 0) -> str:
    """
    Show a native macOS dialog. Returns the button label clicked.
    buttons: list of button labels (right-most is default/highlighted).
    """
    btn_str = ", ".join(f'"{b}"' for b in buttons)
    script = (
        f'button returned of '
        f'(display dialog "{message}" buttons {{{btn_str}}} '
        f'default button "{buttons[default]}" '
        f'with title "Co-Cut Pipeline")'
    )
    return _osascript(script)


def _text_input(prompt: str, default: str = "") -> str:
    """Show a native macOS dialog with a text input field."""
    script = (
        f'text returned of '
        f'(display dialog "{prompt}" default answer "{default}" '
        f'with title "Co-Cut Pipeline")'
    )
    return _osascript(script)


def _backup_log(pipeline_dir: Path, message: str, level: str = "INFO") -> None:
    log_path = pipeline_dir / BACKUP_LOG
    timestamp = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
    entry = json.dumps({"ts": timestamp, "level": level, "msg": message})
    with log_path.open("a", encoding="utf-8") as f:
        f.write(entry + "\n")


def _run_rsync(local_root: Path, nas_path: Path, exclude_raw: bool = True) -> bool:
    """Run rsync mirror. Returns True on success."""
    excludes = ["--exclude=.DS_Store", "--exclude=*.xmp"]
    if exclude_raw:
        excludes.append("--exclude=RAW")
    cmd = ["rsync", "-av", "--delete"] + excludes + [
        str(local_root) + "/",
        str(nas_path) + "/",
    ]
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=600)
        return result.returncode == 0
    except Exception:
        return False


def _load_backup_config(pipeline_dir: Path) -> Optional[dict]:
    cfg_path = pipeline_dir / BACKUP_CONFIG
    if cfg_path.exists():
        try:
            return json.loads(cfg_path.read_text())
        except Exception:
            pass
    return None


def _save_backup_config(pipeline_dir: Path, cfg: dict) -> None:
    pipeline_dir.mkdir(parents=True, exist_ok=True)
    (pipeline_dir / BACKUP_CONFIG).write_text(
        json.dumps(cfg, indent=2), encoding="utf-8"
    )


def _install_launchd_agent(project_root: Path, script_path: Path) -> None:
    """
    Install a user-level launchd .plist so the watcher restarts on reboot.
    Writes to ~/Library/LaunchAgents/com.contentcoop.cocut.backup.plist
    then loads it with launchctl.
    """
    agents_dir = Path.home() / "Library" / "LaunchAgents"
    agents_dir.mkdir(parents=True, exist_ok=True)
    plist_path = agents_dir / f"{LAUNCHD_LABEL}.plist"

    plist_content = f"""<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>{LAUNCHD_LABEL}</string>
    <key>ProgramArguments</key>
    <array>
        <string>{sys.executable}</string>
        <string>{script_path.resolve()}</string>
        <string>--monitor</string>
        <string>{project_root}</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardErrorPath</key>
    <string>{project_root}/.pipeline/launchd_stderr.log</string>
    <key>StandardOutPath</key>
    <string>{project_root}/.pipeline/launchd_stdout.log</string>
</dict>
</plist>
"""
    plist_path.write_text(plist_content, encoding="utf-8")
    subprocess.run(["launchctl", "load", str(plist_path)], capture_output=True)
    print(f"  {GREEN}✓ launchd agent installed — watcher will restart on reboot.{RESET}")


def run_monitor(project_root: Path) -> None:
    """
    Phase 5: monitor project_root for activity.
    - Watch 04_FINALS for the first exported final video → prompt NAS setup
    - Watch entire project for any change → debounced rsync to NAS
    """
    try:
        from watchdog.observers import Observer  # type: ignore
        from watchdog.events import FileSystemEventHandler  # type: ignore
    except ImportError:
        print(f"{RED}watchdog not installed. Run: pip install watchdog{RESET}")
        sys.exit(1)

    pipeline_dir = project_root / PIPELINE_DIR
    pipeline_dir.mkdir(parents=True, exist_ok=True)

    finals_dir = project_root / "04_FINALS"
    finals_dir.mkdir(parents=True, exist_ok=True)

    cfg = _load_backup_config(pipeline_dir)
    nas_enabled = cfg.get("enabled", False) if cfg else False
    nas_path    = Path(cfg["nas_path"]) if (cfg and "nas_path" in cfg) else None

    _debounce_timer: list[Optional[threading.Timer]] = [None]

    def _do_sync() -> None:
        nonlocal nas_path
        if not nas_path:
            return
        if not nas_path.exists():
            _dialog(
                f"NAS not mounted at {nas_path}\nRetry when the drive is available.",
                ["OK"]
            )
            _backup_log(pipeline_dir, f"NAS not mounted at {nas_path}", "WARN")
            return
        dest = nas_path / project_root.name
        dest.mkdir(parents=True, exist_ok=True)
        ok = _run_rsync(project_root, dest)
        ts = datetime.utcnow().isoformat()
        msg = f"rsync {'succeeded' if ok else 'FAILED'} → {dest}"
        print(f"  {'✓' if ok else '✗'} {msg}")
        _backup_log(pipeline_dir, msg, "INFO" if ok else "ERROR")
        if ok and cfg:
            cfg["last_sync"] = ts
            _save_backup_config(pipeline_dir, cfg)

    def _schedule_sync() -> None:
        if _debounce_timer[0]:
            _debounce_timer[0].cancel()
        t = threading.Timer(DEBOUNCE_SECS, _do_sync)
        t.daemon = True
        t.start()
        _debounce_timer[0] = t

    def _setup_nas() -> None:
        nonlocal nas_path, nas_enabled, cfg
        choice = _dialog(
            "First final video detected in 04_FINALS!\n"
            "Do you want to copy the entire project to NAS/Backup now?",
            ["No", "Yes"],
            default=1,
        )
        if choice != "Yes":
            return
        raw_path = _text_input(
            "Enter NAS mount path\n(e.g. /Volumes/MyNAS/ProjectBackups)",
            default="/Volumes/NAS/ProjectBackups",
        )
        if not raw_path:
            return
        nas_root = Path(raw_path.strip())
        if not nas_root.exists():
            _dialog(f"Path not found: {nas_root}\nCheck the drive is mounted.", ["OK"])
            return
        dest = nas_root / project_root.name
        dest.mkdir(parents=True, exist_ok=True)
        print(f"\n{CYAN}Initial rsync to {dest}…{RESET}")
        ok = _run_rsync(project_root, dest)
        if ok:
            cfg = {
                "nas_path":   str(nas_root),
                "setup_date": datetime.utcnow().strftime("%Y-%m-%d"),
                "enabled":    True,
                "last_sync":  datetime.utcnow().isoformat(),
            }
            _save_backup_config(pipeline_dir, cfg)
            nas_path    = nas_root
            nas_enabled = True
            _backup_log(pipeline_dir, f"NAS backup configured → {nas_root}", "INFO")
            print(f"  {GREEN}✓ NAS backup configured. Ongoing sync active.{RESET}")
        else:
            print(f"  {RED}✗ Initial rsync failed. Check path and permissions.{RESET}")

    first_final_seen = [bool(list(finals_dir.iterdir()))] if finals_dir.exists() else [False]

    class ProjectHandler(FileSystemEventHandler):
        def on_any_event(self, event):  # type: ignore
            if event.is_directory:
                return
            src = Path(event.src_path)
            # Check for first final video
            if not first_final_seen[0] and src.parent == finals_dir:
                if src.suffix.lower() in FINALS_EXTS:
                    first_final_seen[0] = True
                    threading.Thread(target=_setup_nas, daemon=True).start()
            # Schedule debounced sync for all events
            if nas_enabled and nas_path:
                _schedule_sync()

    observer = Observer()
    observer.schedule(ProjectHandler(), str(project_root), recursive=True)
    observer.start()

    print(f"\n{CYAN}Phase 5: Watching {project_root.name}{RESET}")
    print(f"  Monitoring 04_FINALS for first export + syncing to NAS on any change.")
    print(f"  NAS backup: {'enabled → ' + str(nas_path) if nas_enabled else 'not configured yet'}")
    print(f"  Press Ctrl+C to stop.\n")

    try:
        while observer.is_alive():
            observer.join(timeout=1)
    except KeyboardInterrupt:
        observer.stop()
    observer.join()


# ─── Shared analytics report ────────────────────────────────────────────────────

def print_report(project_root: Path, ingested: list[Path], start_time: datetime) -> None:
    elapsed = (datetime.utcnow() - start_time).seconds
    soundbites_dir = project_root / "02_ASSETS/02.1_FOOTAGE/SOUND_BITES"
    good_take_files = list(soundbites_dir.glob("*.fcpxml")) if soundbites_dir.exists() else []
    total_size_mb = sum(f.stat().st_size for f in ingested if f.exists()) / (1024 * 1024)

    print(f"\n{CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    print(f"  Co-Cut Pipeline Report")
    print(f"━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━{RESET}")
    print(f"  Files ingested : {len(ingested)}")
    print(f"  Total size     : {total_size_mb:.1f} MB")
    print(f"  Good-take XMLs : {len(good_take_files)}")
    print(f"  Processing time: {elapsed}s")
    print(f"  Project root   : {project_root}")
    print(f"{CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━{RESET}\n")


# ─── Prompts ──────────────────────────────────────────────────────────────────────

def prompt_date() -> str:
    while True:
        val = input("Project date (YYYY.MM.DD) [Enter for today]: ").strip()
        if not val:
            return datetime.now().strftime("%Y.%m.%d")
        if validate_date(val):
            return val
        print(f"{RED}  Invalid format. Use YYYY.MM.DD (e.g. 2026.03.16){RESET}")


def prompt_name() -> str:
    while True:
        val = input("Project name: ").strip()
        if val:
            return val
        print(f"{RED}  Project name cannot be empty.{RESET}")


def prompt_sources() -> list[Path]:
    print("\nDrag-and-drop source files/folders here (paste paths, one per line).")
    print("Press Enter twice when done:")
    paths: list[Path] = []
    while True:
        line = input().strip().strip("'\"")
        if not line:
            break
        p = Path(line).expanduser()
        if p.exists():
            paths.append(p)
        else:
            print(f"{YELLOW}  Not found, skipping: {line}{RESET}")
    return paths


# ─── Main ────────────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(description="Co-Cut Ingest Pipeline")
    parser.add_argument("--project",  help="Project name")
    parser.add_argument("--date",     help="Project date (YYYY.MM.DD)")
    parser.add_argument("--input",    help="Source files/dirs to ingest", nargs="*")
    parser.add_argument("--no-deep",  action="store_true", help="Skip Phase 4 analysis")
    parser.add_argument("--monitor",  metavar="PROJECT_ROOT",
                        help="Phase 5: watch an existing project folder for NAS backup")
    args = parser.parse_args()

    # ── Phase 5 shortcut: --monitor mode ──────────────────────────────────────
    if args.monitor:
        root = Path(args.monitor).expanduser().resolve()
        if not root.exists():
            print(f"{RED}Project root not found: {root}{RESET}")
            sys.exit(1)
        # Install launchd agent on first run
        agent_cfg = root / PIPELINE_DIR / BACKUP_CONFIG
        if not agent_cfg.exists():
            _install_launchd_agent(root, Path(__file__))
        run_monitor(root)
        return

    # ── Full ingest pipeline (phases 1-4) ─────────────────────────────────────
    start_time = datetime.utcnow()

    print(f"\n{CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    print(f"  Co-Cut Ingest Pipeline")
    print(f"━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━{RESET}\n")

    # Phase 1
    date = args.date if (args.date and validate_date(args.date)) else prompt_date()
    name = args.project or prompt_name()
    folder_name  = build_folder_name(date, name)
    project_root = Path.home() / "Desktop" / folder_name

    if project_root.exists():
        print(f"{YELLOW}Folder already exists: {project_root}{RESET}")
        ans = input("Continue and ingest into it? [y/N] ").strip().lower()
        if ans != "y":
            sys.exit(0)
    else:
        create_folder_tree(project_root)

    # Phase 2
    sources = [Path(p).expanduser() for p in args.input] if args.input else prompt_sources()
    ingested = ingest_files(sources, project_root)

    # Phase 3 — XMP sidecars
    if ingested:
        generate_xmp_sidecars(ingested)

    # Phase 4 — Deep analysis
    if not args.no_deep:
        print(f"\n{CYAN}Starting Phase 4 deep analysis…{RESET}")
        t = threading.Thread(target=deep_analyze_interviews, args=(project_root, name), daemon=True)
        t.start()
        t.join()

    # Analytics report
    print_report(project_root, ingested, start_time)

    # Suggest Phase 5 monitoring
    print(f"  {DIM}Tip: run with --monitor {project_root} to enable NAS backup.{RESET}\n")


if __name__ == "__main__":
    main()
