from pathlib import Path
from PIL import Image

assets = Path(__file__).resolve().parents[1] / 'assets'
names = ['project-picker', 'workbench-light', 'reviews-dark', 'native-chat', 'mindmap-light', 'mindmap-dark', 'mindmap-fold']
frames = []
for name in names:
    with Image.open(assets / (name + '.png')) as original:
        frame = original.convert('RGB')
        frame.save(assets / (name + '.png'))
        frames.append(frame)
frames[0].save(assets / 'workbench-demo.gif', save_all=True, append_images=frames[1:], duration=[1800,2200,2200,2400,1800,1800,1800], loop=0, optimize=True)
print('Created seven-frame workbench demonstration from Desktop screenshots.')
