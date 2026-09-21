#!/usr/bin/env python3
"""Publish a reviewed article through the site's existing credential-owning script."""
import fcntl
import hashlib
import html as html_lib
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import time
import urllib.request
from urllib.parse import urljoin

def main():
    data = json.loads(sys.stdin.read(4 * 1024 * 1024 + 1))
    slug, title, text = data['slug'], data['title'], data['text']
    category = data.get('category', 'paper-sharing')
    if not re.fullmatch(r'[a-z0-9][a-z0-9-]{2,100}', slug) or not re.fullmatch(r'[a-z0-9-]+', category):
        raise ValueError('invalid identifier')
    if not isinstance(title, str) or not 1 <= len(title) <= 180 or not isinstance(text, str) or not 100 <= len(text) <= 2000000:
        raise ValueError('invalid article')
    # Do not render active HTML or local file references supplied by generated text.
    if re.search(r'<\s*(script|iframe|style|link|object|embed|form)\b|\bon\w+\s*=|javascript:|file://|/Users/|/home/', text, re.I):
        raise ValueError('unsupported article content')
    root = Path(__file__).resolve().parent.parent
    expected_post = data.get('expectedPostId')
    if expected_post and not re.fullmatch(r'[a-zA-Z0-9-]+', expected_post):
        raise ValueError('invalid update target')
    folder = root / 'workflow-posts' / slug
    folder.mkdir(parents=True, exist_ok=True, mode=0o700)
    with (folder / '.lock').open('w') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        # Resolve only the local API address; credentials stay with the site's publisher.
        base = subprocess.run(['bash', '-c', 'source "$1/.env"; printf "%s" "${HALO_BASE_URL:-http://127.0.0.1:${HALO_PORT:-4147}}"', 'workflow', str(root)], check=True, capture_output=True, text=True).stdout.rstrip('/')
        public_base = subprocess.run(['bash', '-c', 'source "$1/.env"; printf "%s" "${HALO_PUBLIC_URL:-${HALO_EXTERNAL_URL:-}}"', 'workflow', str(root)], check=True, capture_output=True, text=True).stdout.rstrip('/')
        def read_post(post_id):
            with urllib.request.urlopen(base + '/apis/api.content.halo.run/v1alpha1/posts/' + post_id, timeout=30) as response:
                return json.load(response)
        if expected_post:
            post = read_post(expected_post)
            if post.get('metadata', {}).get('name') != expected_post or post.get('spec', {}).get('slug') != slug:
                raise ValueError('update target mismatch')
            with urllib.request.urlopen(base + '/apis/api.content.halo.run/v1alpha1/posts?size=100', timeout=30) as response:
                listed = json.load(response)
            if not any(p.get('metadata', {}).get('name') == expected_post for p in listed.get('items', [])):
                raise ValueError('update target outside publisher index')
            backup = folder / ('before-' + str(time.time_ns()) + '.json')
            backup.write_text(json.dumps(post, ensure_ascii=False))
            os.chmod(backup, 0o600)
        digest = hashlib.sha256((title + '\n' + text).encode()).hexdigest()
        md = folder / (digest + '.md')
        html = folder / (digest + '.html')
        md.write_text(text)
        os.chmod(md, 0o600)
        subprocess.run([str(root / 'scripts/render-markdown.sh'), str(md), str(html)], check=True, capture_output=True, timeout=120)
        body = html.read_text()
        # Give headings stable anchors for the site's table of contents.
        number = [0]
        def heading(match):
            number[0] += 1
            return '<h' + match[1] + ' id="section-' + str(number[0]) + '">'
        body = re.sub(r'<h([2-6])>', heading, body)
        html.write_text(body)
        if data.get('dryRun'):
            print(json.dumps({'status': 'validated', 'slug': slug, 'headings': number[0]}))
            return
        receipt = folder / (digest + '.json')
        result = None
        if expected_post and post.get('content', {}).get('raw') == text and post.get('spec', {}).get('title') == title and category in post.get('spec', {}).get('categories', []) and post.get('status', {}).get('phase') == 'PUBLISHED':
            result = {'status': 'published', 'postId': expected_post, 'url': urljoin(public_base + '/', post['status']['permalink']), 'slug': slug}
        if receipt.exists():
            cached = json.loads(receipt.read_text())
            current = read_post(cached['postId'])
            if current.get('content', {}).get('raw') == text and current.get('spec', {}).get('title') == title and category in current.get('spec', {}).get('categories', []) and current.get('status', {}).get('phase') == 'PUBLISHED':
                result = cached
        if result is None:
            env = {**os.environ, 'POST_TITLE': title, 'POST_SLUG': slug, 'POST_CATEGORY': category,
                   'POST_MARKDOWN_FILE': str(md), 'POST_HTML_FILE': str(html)}
            proc = subprocess.run([str(root / 'scripts/publish-post.sh')], env=env, check=True, capture_output=True, text=True, timeout=180)
            match = re.search(r'Post (?:created|updated): (\S+) (\S+)', proc.stdout)
            if not match:
                raise ValueError('publication receipt unavailable')
            result = {'status': 'published', 'postId': match[1], 'url': urljoin(public_base + '/', match[2]), 'slug': slug}
        if expected_post and result.get('postId') != expected_post:
            raise ValueError('published target mismatch')
        current = read_post(result['postId'])
        if current.get('content', {}).get('raw') != text or category not in current.get('spec', {}).get('categories', []):
            raise ValueError('published content mismatch')
        with urllib.request.urlopen(result['url'], timeout=30) as response:
            if response.status != 200:
                raise ValueError('public verification failed')
            page = html_lib.unescape(response.read(8 * 1024 * 1024).decode('utf-8', errors='replace'))
            if title not in page:
                raise ValueError('public article title mismatch')
        receipt.write_text(json.dumps(result))
        os.chmod(receipt, 0o600)
        print(json.dumps(result))

if __name__ == '__main__':
    try:
        main()
    except Exception:
        print('HALO_PUBLISH_FAILED', file=sys.stderr)
        sys.exit(1)
