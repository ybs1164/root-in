"""Resume a partial pinned PBF with four bounded HTTP range requests."""
from concurrent.futures import ThreadPoolExecutor
import hashlib
import shutil
import requests
from build import RAW, SOURCE, SOURCE_MD5

path = RAW / "south-korea.osm.pbf"
start = path.stat().st_size
total = 288242629
step = (total - start + 3) // 4


def chunk(index):
    begin = start + index * step
    end = min(total - 1, begin + step - 1)
    part = RAW / f"range-{index}.part"
    if begin > end:
        return None
    with requests.get(SOURCE, headers={"Range": f"bytes={begin}-{end}"}, stream=True, timeout=120) as response:
        response.raise_for_status()
        assert response.status_code == 206
        assert response.headers["Content-Range"] == f"bytes {begin}-{end}/{total}"
        with part.open("wb") as stream:
            for data in response.iter_content(1024 * 1024):
                stream.write(data)
    assert part.stat().st_size == end - begin + 1
    print(f"Range {index} complete", flush=True)
    return part


with ThreadPoolExecutor(max_workers=4) as pool:
    parts = list(pool.map(chunk, range(4)))
assembled = RAW / "completed.pbf"
with assembled.open("wb") as output:
    for source in [path, *filter(None, parts)]:
        with source.open("rb") as input_stream:
            shutil.copyfileobj(input_stream, output, 1024 * 1024)
with assembled.open("rb") as stream:
    assert hashlib.file_digest(stream, "md5").hexdigest() == SOURCE_MD5
assembled.replace(path)
print(f"Verified complete PBF: {path.stat().st_size:,} bytes", flush=True)
