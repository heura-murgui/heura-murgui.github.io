// Fetch blocks from Arena channel and update the shelf
(function() {
    // Enter the Are.na channel slug here. 
    const CHANNEL_SLUG = 'heura-murgui; // <-- ¡MODIFICA ESTA LÍNEA!
    const API_BASE = 'https://api.are.na/v2';
    
    // Function to fetch a page of contents
    async function fetchPage(page = 1, per = 100) {
        try {
            const response = await fetch(`${API_BASE}/channels/${CHANNEL_SLUG}/contents?page=${page}&per=${per}&direction=desc`, {
                method: 'GET',
                headers: { 'Cache-Control': 'no-cache' }
            });
            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Error fetching page:', error);
            return null;
        }
    }

    // Function to fetch all blocks from the channel
    async function fetchArenaBlocks() {
        const allBlocks = [];
        let page = 1;
        let hasMore = true;
        
        while (hasMore) {
            const data = await fetchPage(page, 20);
            if (!data || !data.contents) break;
            
            allBlocks.push(...data.contents);
            
            hasMore = data.contents.length === 20;
            page++;
        }
        
        console.log(`Fetched ${allBlocks.length} blocks from Arena`);
        return allBlocks;
    }
    // Normalize blocks we know how to render and return all of them
    function normalizeRenderableBlocks(blocks) {
        const renderables = [];
        for (const block of blocks) {
            if (!block || !block.class) continue;
            // Text
            if (block.class === 'Text' && (block.content || block.description)) {
                renderables.push({
                    type: 'text',
                    content: block.content_html || block.description,
                    title: block.title || null,
                    source: block.source && block.source.url ? block.source.url : null,
                    created_at: block.created_at
                });
                continue;
            }
            // Image
            if (block.class === 'Image' && block.image && (block.image.original || block.image.large || block.image.display)) {
                const image = block.image;
                const url = (image.original && image.original.url) || (image.large && image.large.url) || (image.display && image.display.url);
                if (url) {
                    renderables.push({
                        type: 'image',
                        url,
                        title: block.title || block.description || 'Image from Are.na',
                        created_at: block.created_at
                    });
                }
                continue;
            }
            // Video (mp4 or video embed)
            if (
                (block.attachment && (block.attachment.extension === 'mp4' || (block.attachment.content_type && block.attachment.content_type.startsWith('video/')))) ||
                (block.embed && block.embed.type === 'video')
            ) {
                const url = (block.attachment && block.attachment.url) || (block.embed && (block.embed.source_url || (block.source && block.source.url)));
                renderables.push({
                    type: 'video',
                    url,
                    title: block.title || block.description || 'Video from Are.na',
                    created_at: block.created_at
                });
                continue;
            }
            // Link
            if (block.class === 'Link' && block.source && block.source.url) {
                renderables.push({
                    type: 'link',
                    url: block.source.url,
                    title: block.title || block.source.title || block.source.url,
                    created_at: block.created_at
                });
                continue;
            }
        }
        return renderables;
    }
    
    // Function to format date for display
    function formatDate(dateString) {
        const date = new Date(dateString);
        const options = { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        };
        return date.toLocaleDateString('en-US', options);
    }

    // Render all items into the sidebar in chronological order
    function renderShelf(items) {
        const shelf = document.getElementById('shelf');
        if (!shelf) return;
        shelf.innerHTML = '';
        
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            const wrapper = document.createElement('div');
            wrapper.className = 'shelf-item';
            
            // LÓGICA DE CLASES BENTO PARA CSS GRID
            if (i === 0) {
                // El primer elemento (más reciente) es grande (2x2)
                wrapper.classList.add('bento-large');
            } else if (item.type === 'image') {
                // Las imágenes ocupan más espacio horizontal (2x1)
                wrapper.classList.add('bento-wide');
            }
            // Si es texto, enlace o video (no el primero), usa el tamaño estándar (1x1)

            if (item.type === 'image') {
                const img = document.createElement('img');
                img.src = item.url;
                img.alt = item.title || '';
                wrapper.appendChild(img);
            } else if (item.type === 'video') {
                const video = document.createElement('video');
                video.src = item.url;
                video.controls = true;
                video.style.width = '100%';
                video.style.height = 'auto';
                wrapper.appendChild(video);
            } else if (item.type === 'text') {
                const div = document.createElement('div');
                div.innerHTML = item.content; // No añadir <p>, ya tiene HTML
                wrapper.appendChild(div);
            } else if (item.type === 'link') {
                const a = document.createElement('a');
                a.href = item.url;
                a.textContent = item.title || item.url;
                a.target = '_blank';
                wrapper.appendChild(a);
            }
            const timeEl = document.createElement('time');
            timeEl.textContent = formatDate(item.created_at);
            timeEl.setAttribute('datetime', item.created_at);
            wrapper.appendChild(timeEl);
            shelf.appendChild(wrapper);
        }
    }
    
    // Function to run everything
    async function updateFromArena() {
        console.log('Fetching blocks from Arena channel:', CHANNEL_SLUG);
        
        // Test channel access
        try {
            const testResponse = await fetch(`${API_BASE}/channels/${CHANNEL_SLUG}`, {
                method: 'GET',
                headers: { 'Cache-Control': 'no-cache' }
            });
            
            if (!testResponse.ok) {
                console.error(`Channel access failed: ${testResponse.status} ${testResponse.statusText}`);
                if (testResponse.status === 401) {
                    console.error('Channel is private. Make sure your channel is set to "open" or "closed".');
                } else if (testResponse.status === 404) {
                    console.error('Channel not found. Check the channel slug.');
                }
                return;
            }
            
            const channelInfo = await testResponse.json();
            console.log('Channel info:', channelInfo.title, 'Status:', channelInfo.status, 'Length:', channelInfo.length);
            
        } catch (error) {
            console.error('Error accessing channel:', error);
            return;
        }
        
        const blocks = await fetchArenaBlocks();
        if (blocks.length === 0) {
            console.log('No blocks found or error occurred');
            return;
        }
        // Sort from newest to oldest
        const sorted = [...blocks].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        const items = normalizeRenderableBlocks(sorted);
        renderShelf(items);
    }
    
    // Run when DOM is loaded
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', updateFromArena);
    } else {
        updateFromArena();
    }
    
    // Also expose globally for debugging
    window.updateFromArena = updateFromArena;
    
})();
