document.addEventListener('DOMContentLoaded', () => {
    const kanbanBoard = document.getElementById('kanban-board');
    const themeToggleBtn = document.getElementById('theme-toggle');
    const exportDataBtn = document.getElementById('export-data-btn');
    let weekDates = [];

    // --- 날짜 관리 ---
    const setupWeekDates = () => {
        const today = new Date();
        const dayOfWeek = today.getDay();
        const startDate = new Date(today);
        startDate.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
        const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
        weekDates = [];
        for (let i = 0; i < 7; i++) {
            const currentDate = new Date(startDate);
            currentDate.setDate(startDate.getDate() + i);
            const dateString = `${currentDate.getMonth() + 1}/${currentDate.getDate()} (${dayNames[currentDate.getDay()]})`;
            weekDates.push(dateString);
        }
    };

    // --- 테마 관리 ---
    const applyTheme = (theme) => {
        document.body.classList.toggle('dark-mode', theme === 'dark');
        themeToggleBtn.textContent = theme === 'dark' ? '🌙' : '☀️';
    };

    themeToggleBtn.addEventListener('click', () => {
        const newTheme = document.body.classList.contains('dark-mode') ? 'light' : 'dark';
        localStorage.setItem('kanbanTheme', newTheme);
        applyTheme(newTheme);
    });

    // --- 데이터 관리 ---
    const loadData = async () => {
        try {
            const response = await fetch('data.json');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            console.error('Error loading data.json, falling back to sample data:', error);
            const initialData = {};
            weekDates.forEach(date => {
                initialData[date] = [{
                    id: `card-${Date.now()}-${Math.random()}`,
                    title: `샘플: ${date.split(' ')[0]} 계획`,
                    description: '클릭해서 내용을 수정하세요.'
                }];
            });
            return initialData;
        }
    };

    // saveData는 이제 로컬 저장소에 저장하지 않습니다. (데이터 내보내기 기능만 사용)
    const saveData = (data) => {
        // localStorage.setItem('kanbanData_v3', JSON.stringify(data)); // 더 이상 사용 안 함
        console.log('데이터가 로컬 저장소에 저장되지 않습니다. 내보내기 기능을 사용하세요.');
    };

    // --- 데이터 내보내기 ---
    exportDataBtn.addEventListener('click', () => {
        const dataToExport = currentBoardData; // 현재 메모리상의 데이터를 내보냅니다.
        const jsonString = JSON.stringify(dataToExport, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'kanban_board_data.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    });

    let currentBoardData = {}; // 현재 보드 데이터를 저장할 변수

    // --- 보드 렌더링 ---
    const renderBoard = (boardData) => {
        currentBoardData = boardData; // 렌더링 시 현재 데이터 업데이트
        kanbanBoard.innerHTML = '';
        weekDates.forEach(date => {
            const column = createColumn(date, boardData);
            kanbanBoard.appendChild(column);
        });
    };

    // --- 컬럼 및 카드 생성 ---
    const createColumn = (date, boardData) => {
        const column = document.createElement('div');
        column.className = 'column';
        column.dataset.date = date;
        column.innerHTML = `<div class="column-title">${date}</div><div class="card-list"></div><button class="add-card-btn">+ 카드 추가</button>`;
        
        const cardList = column.querySelector('.card-list');
        if (boardData[date]) {
            boardData[date].forEach(cardData => cardList.appendChild(createCard(cardData)));
        }

        column.querySelector('.add-card-btn').addEventListener('click', () => addCard(date));
        column.addEventListener('dragover', handleDragOver);
        column.addEventListener('dragleave', handleDragLeave);
        column.addEventListener('drop', (e) => handleDrop(e, date));
        return column;
    };

    const createCard = (cardData) => {
        const card = document.createElement('div');
        card.className = 'card';
        card.draggable = true;
        card.dataset.id = cardData.id;

        card.innerHTML = `
            <div class="card-title">${cardData.title}</div>
            <div class="card-description">${cardData.description}</div>
            <button class="delete-card">&times;</button>
        `;

        card.querySelector('.delete-card').addEventListener('click', (e) => {
            e.stopPropagation();
            deleteCard(cardData.id);
        });

        // 인라인 편집 이벤트 리스너 추가
        card.querySelector('.card-title').addEventListener('click', (e) => handleEdit(e.target, cardData.id, 'title'));
        card.querySelector('.card-description').addEventListener('click', (e) => handleEdit(e.target, cardData.id, 'description'));

        card.addEventListener('dragstart', handleDragStart);
        card.addEventListener('dragend', handleDragEnd);
        return card;
    };

    // --- 인라인 편집 핸들러 ---
    const handleEdit = (element, cardId, field) => {
        const currentText = element.textContent;
        const input = document.createElement(field === 'title' ? 'input' : 'textarea');
        input.className = `edit-${field}`;
        input.value = currentText;

        element.replaceWith(input);
        input.focus();

        const saveEdit = () => {
            const newText = input.value.trim();
            // currentBoardData를 직접 수정
            for (const date in currentBoardData) {
                const card = currentBoardData[date].find(c => c.id === cardId);
                if (card) {
                    card[field] = newText || currentText; 
                    break;
                }
            }
            renderBoard(currentBoardData); // 변경된 데이터로 다시 렌더링
        };

        input.addEventListener('blur', saveEdit);
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && (field === 'title' || e.ctrlKey)) {
                saveEdit();
            }
        });
    };

    // --- CRUD 함수 ---
    const addCard = (date) => {
        const title = prompt('카드 제목을 입력하세요:');
        if (!title || !title.trim()) return;
        const newCard = { id: `card-${Date.now()}`, title: title.trim(), description: '내용을 입력하세요.' };
        
        if (!currentBoardData[date]) {
            currentBoardData[date] = [];
        }
        currentBoardData[date].push(newCard);
        renderBoard(currentBoardData);
    };

    const deleteCard = (cardId) => {
        if (!confirm('정말로 이 카드를 삭제하시겠습니까?')) return;
        for (const date in currentBoardData) {
            currentBoardData[date] = currentBoardData[date].filter(c => c.id !== cardId);
        }
        renderBoard(currentBoardData);
    };

    // --- 드래그 앤 드롭 핸들러 ---
    let draggedCardId = null;
    const handleDragStart = (e) => {
        draggedCardId = e.target.dataset.id;
        setTimeout(() => e.target.classList.add('dragging'), 0);
    };
    const handleDragEnd = (e) => {
        e.target.classList.remove('dragging');
        draggedCardId = null;
    };
    const handleDragOver = (e) => {
        e.preventDefault();
        e.currentTarget.classList.add('drag-over');
    };
    const handleDragLeave = (e) => e.currentTarget.classList.remove('drag-over');
    const handleDrop = (e, targetDate) => {
        e.preventDefault();
        e.currentTarget.classList.remove('drag-over');
        if (!draggedCardId) return;

        let draggedCard = null;
        for (const date in currentBoardData) {
            const cardIndex = currentBoardData[date].findIndex(c => c.id === draggedCardId);
            if (cardIndex > -1) {
                [draggedCard] = currentBoardData[date].splice(cardIndex, 1);
                break;
            }
        }
        if (draggedCard) {
            if (!currentBoardData[targetDate]) {
                currentBoardData[targetDate] = [];
            }
            currentBoardData[targetDate].push(draggedCard);
            renderBoard(currentBoardData);
        }
    };

    // --- 초기화 ---
    const initialize = async () => {
        setupWeekDates();
        const boardData = await loadData(); // 비동기 로드
        const savedTheme = localStorage.getItem('kanbanTheme') || 'light';
        applyTheme(savedTheme);
        renderBoard(boardData);
    };

    initialize();
});