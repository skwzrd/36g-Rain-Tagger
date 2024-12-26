const f_inputs = {
    f_tag: document.getElementById('f_tag'),
    f_general: document.getElementById('f_general'),
    f_sensitive: document.getElementById('f_sensitive'),
    f_explicit: document.getElementById('f_explicit'),
    f_questionable: document.getElementById('f_questionable'),
};

const f_values = {
    f_tag: document.getElementById('f_tag_value'),
    f_general: document.getElementById('f_general_value'),
    f_sensitive: document.getElementById('f_sensitive_value'),
    f_explicit: document.getElementById('f_explicit_value'),
    f_questionable: document.getElementById('f_questionable_value'),
};

const general_tag_input = document.getElementById('general_tag_input');
const character_tag_input = document.getElementById('character_tag_input');
const file_input = document.getElementById('img');
const general_tag_suggestions = document.getElementById('general_tag_suggestions');
const character_tag_suggestions = document.getElementById('character_tag_suggestions');
const selected_general_tags_div = document.getElementById('selected_general_tags');
const selected_character_tags_div = document.getElementById('selected_character_tags');
const search_button = document.getElementById('search_button');
const clear_button = document.getElementById('clear_button');
const display_button = document.getElementById('display_button');
const results_div = document.getElementById('results');

let selected_general_tags = [];
let selected_character_tags = [];
let all_tags = [];
let results = [];
let current_display_mode = 'Gallery';
let message = [];


Object.keys(f_inputs).forEach(f => {
    f_inputs[f].addEventListener('input', () => {
        f_values[f].textContent = parseFloat(f_inputs[f].value).toFixed(1);
    });
});

async function fetch_all_tags() {
    const response = await fetch('/tags');
    all_tags = await response.json();
}

fetch_all_tags();


function handle_tag_input(inputElement, suggestion_container, tagType) {
    const query = inputElement.value.trim().toLowerCase();
    if (query.length === 0) {
        suggestion_container.innerHTML = '';
        return;
    }
    const filtered_tags = all_tags.filter(tag => tag.tag_type_name === tagType && tag.tag_name.toLowerCase().includes(query));
    suggestion_container.innerHTML = filtered_tags.map(tag => `
        <div class="tag_suggestion" data-id="${tag.tag_id}">${tag.tag_name}</div>
    `).join('');
    attach_suggestion_events(suggestion_container, selected_general_tags, render_general_tags);
}

general_tag_input.addEventListener('input', () => {
    handle_tag_input(general_tag_input, general_tag_suggestions, 'general');
});

general_tag_input.addEventListener('focus', () => {
    handle_tag_input(general_tag_input, general_tag_suggestions, 'general');
});

character_tag_input.addEventListener('input', () => {
    handle_tag_input(character_tag_input, character_tag_suggestions, 'character');
});

character_tag_input.addEventListener('focus', () => {
    handle_tag_input(character_tag_input, character_tag_suggestions, 'character');
});

function attach_suggestion_events(suggestions_div, selected_tags, render_fn) {
    suggestions_div.querySelectorAll('.tag_suggestion').forEach(suggestion => {
        suggestion.addEventListener('click', () => {
            const tag_id = parseInt(suggestion.getAttribute('data-id'));
            const tag_name = suggestion.textContent.trim();
            if (!selected_tags.some(tag => tag.id === tag_id)) {
                selected_tags.push({ id: tag_id, name: tag_name });
                render_fn();
            }
            suggestion.outerHTML = '';
        });
    });
}

function render_general_tags() {
    render_tags(selected_general_tags_div, selected_general_tags, selected_general_tags, render_general_tags);
}

function render_character_tags() {
    render_tags(selected_character_tags_div, selected_character_tags, selected_character_tags, render_character_tags);
}

function render_tags(container, tags, selected_tags, render_fn) {
    container.innerHTML = tags.map(tag => `
        <span class="pill">${tag.name} <button data-id="${tag.id}">x</button></span>
    `).join('');
    container.querySelectorAll('button[data-id]').forEach(button => {
        button.addEventListener('click', () => {
            const tag_id = parseInt(button.getAttribute('data-id'));
            selected_tags.splice(selected_tags.findIndex(tag => tag.id === tag_id), 1);
            render_fn();
        });
    });
}

function render_tags_text(tags, color) {
    return Object.entries(tags).map(([tag, prob]) => `
    <span class="pill ${color}">${tag}: ${prob.toFixed(2)}</span>
    `).join(' ');
}

clear_button.addEventListener('click', () => {
    selected_general_tags = [];
    selected_character_tags = [];

    selected_general_tags_div.innerHTML = '';
    selected_character_tags_div.innerHTML = '';

    general_tag_input.value = '';
    character_tag_input.value = '';
    general_tag_suggestions.innerHTML = '';
    character_tag_suggestions.innerHTML = '';

    Object.keys(f_inputs).forEach(f => {
        f_inputs[f].value = 0.0;
        f_values[f].textContent = '0.0';
    });
});

function render_results() {
    results_div.innerHTML = `<div class="row">${message}</div>`;

    if (results.length === 0) {
        return;
    }

    if (current_display_mode === 'Gallery') {
        results_div.innerHTML += results.map(result => `
            <div class="row">
                <img class="result" src="/serve${result.image_path}" loading="lazy"/>
                <div class="pills">
                    ${render_tags_text(result.rating, 'rating')}
                    ${render_tags_text(result.general, 'general')}
                    ${render_tags_text(result.character, 'character')}
                </div>
            </div>
        `).join('');
    } else {
        results_div.innerHTML += results.map(result => `
            <img class="result" src="/serve${result.image_path}" loading="lazy"/>
        `).join('');
    }
}

search_button.addEventListener('click', async () => {
    await fetch_results();
    render_results();
});

display_button.addEventListener('click', async () => {
    if (results.length === 0) {
        await fetch_results();
    }

    if (current_display_mode === 'Gallery') {
        current_display_mode = 'Info';
        display_button.textContent = 'Display: Info';
    } else {
        current_display_mode = 'Gallery';
        display_button.textContent = 'Display: Gallery';
    }

    render_results();
});


async function fetch_task_result(id, max_attempts = 10, delay = 3000, attempts = 1) {
    const response = await fetch(`/task_result/${id}`);
    const task = await response.json();
    if (task.ready) {
        search_button.disabled = false;
        return task.value;
    } else if (attempts < max_attempts) {
        return new Promise(resolve => setTimeout(resolve, delay)).then(() => fetch_task_result(id, max_attempts, delay * attempts, attempts + 1));
    } else {
        search_button.disabled = false;
        throw new Error(`Task result not ready after ${max_attempts} attempts`);
    }
}


async function fetch_results() {
    var d;
    if (file_input.files && file_input.files.length > 0) {
        search_button.disabled = true;
        results_div.innerHTML = `<div class="row">Searching...</div>`;
        const formData = new FormData();
        formData.append("img", file_input.files[0]);
        const response = await fetch("/search_w_file", {
            method: "POST",
            body: formData
        });
        d = await response.json();
        d = await fetch_task_result(d.task_id);
    }
    else {
        const params = new URLSearchParams();

        Object.keys(f_inputs).forEach(f => {
            params.append(f, parseFloat(f_inputs[f].value));
        });

        selected_general_tags.forEach(tag => params.append('general_tag_ids', tag.id));
        selected_character_tags.forEach(tag => params.append('character_tag_ids', tag.id));

        const response = await fetch(`/search_w_tags?${params.toString()}`);
        d = await response.json();
    }

    results = d.results;
    message = d.message;
}