from pathlib import Path
import hashlib
import json
import re
import subprocess
import imageio_ffmpeg

ROOT = Path(__file__).resolve().parents[2]
FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()
video = ROOT / 'public/walkthrough/auditlock-live-walkthrough.mp4'
report_path = ROOT / 'artifacts/walkthrough-video.json'
report = json.loads(report_path.read_text(encoding='utf-8'))
probe = subprocess.run([FFMPEG, '-hide_banner', '-i', str(video)], capture_output=True, text=True)
assert re.search(r'Video: h264.*1440x900', probe.stderr), probe.stderr
assert 'Audio: aac' in probe.stderr, probe.stderr
result = subprocess.run([FFMPEG, '-v', 'error', '-i', str(video), '-map', '0:v:0', '-map', '0:a:0', '-f', 'null', '-'], capture_output=True, text=True)
assert result.returncode == 0, result.stderr
assert hashlib.sha256(video.read_bytes()).hexdigest() == report['sha256']
qa = ROOT / 'artifacts/private/walkthrough/qa'
qa.mkdir(parents=True, exist_ok=True)
for name, second in [('start', 4), ('consensus', next(chapter['start'] + 12 for chapter in report['chapters'] if chapter['id'] == 'inspect-ruling')), ('result', report['durationSeconds'] - 9)]:
    subprocess.run([FFMPEG, '-hide_banner', '-loglevel', 'error', '-y', '-ss', str(second), '-i', str(video), '-frames:v', '1', str(qa / f'{name}.png')], check=True)
report['status'] = 'VALIDATED'
report['decodeCheck'] = 'Complete audio and video decoded without errors'
report['videoCodec'] = 'H.264'
report['audioCodec'] = 'AAC'
report_path.write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
print('FULL VIDEO AND AUDIO DECODE PASSED', report['durationSeconds'], report['outputBytes'])
