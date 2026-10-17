from pathlib import Path
import hashlib
import json
import subprocess
import textwrap
import wave
import imageio_ffmpeg

ROOT = Path(__file__).resolve().parents[2]
WORK = ROOT / 'artifacts/private/walkthrough'
PUBLIC = ROOT / 'public/walkthrough'
FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()
PUBLIC.mkdir(parents=True, exist_ok=True)
capture = json.loads((WORK / 'capture.json').read_text(encoding='utf-8'))
narration = json.loads((ROOT / 'scripts/walkthrough/narration.json').read_text(encoding='utf-8'))
proof = json.loads((ROOT / 'artifacts/walkthrough-live-verification.json').read_text(encoding='utf-8'))
assert proof['status'] == 'PASSED', 'Do not render a successful-run walkthrough before actual live verification passes.'
assert len(proof['transactions']) == 17
assert all(transaction['status'] == 'FINALIZED_SUCCESS' for transaction in proof['transactions'])
assert len(proof['withdrawals']) == 3


def run(arguments):
    result = subprocess.run([FFMPEG, '-hide_banner', '-loglevel', 'error', '-y', *map(str, arguments)], capture_output=True, text=True)
    if result.returncode:
        raise RuntimeError(result.stderr[-5000:])


def stamp(seconds):
    milliseconds = round(seconds * 1000)
    return f'{milliseconds // 3600000:02}:{milliseconds // 60000 % 60:02}:{milliseconds // 1000 % 60:02}.{milliseconds % 1000:03}'


chapters = []
cues = ['WEBVTT', '']
offset = 0
clips = capture['clips']
for position, clip in enumerate(clips):
    label = clip['label']
    spoken = narration[label]
    frames = clip['frames']
    assert len(frames) >= 5, f'Insufficient real recorded frames: {label}'
    audio = WORK / 'audio' / f'{label}.wav'
    with wave.open(str(audio), 'rb') as voice:
        audio_duration = voice.getnframes() / voice.getframerate()
    source_duration = clip['end'] - clip['start']
    duration = max(source_duration, audio_duration + 1)
    concat_lines = ['ffconcat version 1.0']
    for frame_index, frame in enumerate(frames):
        start = frame['at'] - frames[0]['at']
        end = frames[frame_index + 1]['at'] - frames[0]['at'] if frame_index + 1 < len(frames) else duration
        filename = (WORK / 'frames' / frame['file']).as_posix()
        concat_lines.extend([f"file '{filename}'", f'duration {max(.001, end - start):.6f}'])
    concat_lines.append(f"file '{(WORK / 'frames' / frames[-1]['file']).as_posix()}'")
    concat_path = WORK / f'clip-{position:02}.ffconcat'
    concat_path.write_text('\n'.join(concat_lines) + '\n', encoding='utf-8')
    output = WORK / f'chapter-{position:02}.mp4'
    run(['-f', 'concat', '-safe', '0', '-i', concat_path, '-i', audio, '-t', duration,
         '-vf', 'crop=1440:900:0:0,fps=12,setsar=1', '-af', 'apad',
         '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '22', '-pix_fmt', 'yuv420p',
         '-c:a', 'aac', '-b:a', '112k', '-movflags', '+faststart', output])
    chapter = {'id': label, 'title': spoken['title'], 'start': round(offset, 3), 'duration': round(duration, 3),
               'sourceStartSeconds': clip['start'], 'sourceEndSeconds': clip['end'], 'recordedFrames': len(frames)}
    chapters.append(chapter)
    lines = textwrap.wrap(spoken['text'], width=88, break_long_words=False)
    character_total = sum(len(line) for line in lines)
    cue_start = offset
    for line in lines:
        cue_end = cue_start + audio_duration * len(line) / character_total
        cues.extend([f'{stamp(cue_start)} --> {stamp(cue_end)}', line, ''])
        cue_start = cue_end
    offset += duration
    print('Encoded', label, round(duration, 1), flush=True)

all_clips = WORK / 'all-chapters.ffconcat'
all_clips.write_text('ffconcat version 1.0\n' + ''.join(f"file '{(WORK / f'chapter-{position:02}.mp4').as_posix()}'\n" for position in range(len(chapters))), encoding='utf-8')
metadata = [';FFMETADATA1', 'title=AUDITLOCK - app walkthrough and fresh live tests',
            'comment=Actual browser captures. Confirmation waits omitted between clips. Synthetic narration. SDK test-wallet signing, not customer browser-wallet signing.']
for chapter in chapters:
    metadata.extend(['[CHAPTER]', 'TIMEBASE=1/1000', f"START={round(chapter['start'] * 1000)}", f"END={round((chapter['start'] + chapter['duration']) * 1000)}", 'title=' + chapter['title']])
metadata_path = WORK / 'chapters.ffmetadata'
metadata_path.write_text('\n'.join(metadata) + '\n', encoding='utf-8')
final = PUBLIC / 'auditlock-live-walkthrough.mp4'
run(['-f', 'concat', '-safe', '0', '-i', all_clips, '-i', metadata_path, '-map_metadata', '1', '-map_chapters', '1', '-c', 'copy', '-movflags', '+faststart', final])
(PUBLIC / 'captions.vtt').write_text('\n'.join(cues), encoding='utf-8')
(PUBLIC / 'chapters.json').write_text(json.dumps(chapters, indent=2) + '\n', encoding='utf-8')
run(['-i', WORK / 'frames' / clips[0]['frames'][0]['file'], '-vf', 'crop=1440:900:0:0', '-frames:v', '1', PUBLIC / 'poster.png'])
transcript = '# AUDITLOCK recorded walkthrough\n\nActual app navigation, form entry, and a new live SDK integration run. Confirmation waits are omitted between recorded clips. Narration uses an offline synthetic voice. Signed writes use fresh in-memory test wallets; customer browser-wallet signing is not shown. Reports are synthetic fixtures, while the transactions, consensus, and transfers are real StudioNet operations. The first rate-limited attempt is retained and disclosed.\n\n'
for chapter in chapters:
    transcript += f"## {stamp(chapter['start'])[:8]} — {chapter['title']}\n\n{narration[chapter['id']]['text']}\n\n"
transcript += f"Live run: `{proof['runId']}`. Audit: `{proof['auditId']}`. Cancellation: `{proof['cancelledAuditId']}`.\n"
(ROOT / 'WALKTHROUGH.md').write_text(transcript, encoding='utf-8')
report = {'status': 'RENDERED', 'durationSeconds': round(offset, 3), 'dimensions': [1440, 900],
          'outputBytes': final.stat().st_size, 'sha256': hashlib.sha256(final.read_bytes()).hexdigest(),
          'method': 'Actual timed browser captures edited to omit network waits; offline synthetic narration; optional captions.',
          'signing': 'Fresh in-memory SDK test wallets, confirmed individually in a local operator console. No customer browser-wallet signatures.',
          'liveRun': proof['runId'], 'auditId': proof['auditId'], 'realParentTransactions': 17, 'withdrawalTransfers': 3,
          'interruptedAttempt': 'See walkthrough-attempt-rate-limited.json. Its accepted test escrow remains governed by its original deadline.',
          'chapters': chapters}
(ROOT / 'artifacts/walkthrough-video.json').write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
print('VIDEO RENDERED', round(offset, 2), final.stat().st_size, flush=True)
