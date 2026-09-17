"""Export the two approved clips at 12 fps, with white transitions baked in.
Requires imageio-ffmpeg: pip install imageio-ffmpeg
"""
from pathlib import Path
import subprocess, imageio_ffmpeg
root=Path(__file__).resolve().parents[1]
out=root/'dist/assets/film-sequence';out.mkdir(exist_ok=True)
ff=imageio_ffmpeg.get_ffmpeg_exe()
clips=[('Lotte_scroll_1.mp4','fade=t=out:st=5.5:d=0.9167:color=white',1),
       ('Lotte_scroll_2.mp4','fade=t=in:st=0:d=0.75:color=white,fade=t=out:st=15.2:d=1.05:color=white',79)]
for name,fade,start in clips:
 subprocess.run([ff,'-y','-i',str(root.parent/'Videos'/name),'-an','-vf',f'fps=12,scale=720:-2,{fade}','-q:v','3','-start_number',str(start),str(out/'frame-%04d.jpg')],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
print(f'Exported {len(list(out.glob("*.jpg")))} frames into {out}')
