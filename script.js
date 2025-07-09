document.addEventListener('DOMContentLoaded', () => {
    const currentWeekBoard = document.getElementById('current-week-board');
    const previousWeekBoard = document.getElementById('previous-week-board');
    const themeToggleBtn = document.getElementById('theme-toggle');
    const exportDataBtn = document.getElementById('export-data-btn');
    
    let currentWeekDates = [];
    let previousWeekDates = [];
    let allBoardData = {}; // 전체 주간 데이터를 저장할 객체

    // --- 날짜 관리 ---
    const setupWeekDates = () => {
        const today = new Date();
        const dayOfWeek = today.getDay(); // 0=일요일, 1=월요일, ...
        const dayNames = ['일', '월', '화', '수', '목', '금', '토'];

        // 이번 주 날짜 계산 (월요일부터 시작)
        const currentWeekStartDate = new Date(today);
        currentWeekStartDate.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
        currentWeekDates = [];
        for (let i = 0; i < 7; i++) {
            const currentDate = new Date(currentWeekStartDate);
            currentDate.setDate(currentWeekStartDate.getDate() + i);
            currentWeekDates.push(`${currentDate.getMonth() + 1}/${currentDate.getDate()} (${dayNames[currentDate.getDay()]})`);
        }

        // 지난 주 날짜 계산
        const previousWeekStartDate = new Date(currentWeekStartDate);
        previousWeekStartDate.setDate(currentWeekStartDate.getDate() - 7);
        previousWeekDates = [];
        for (let i = 0; i < 7; i++) {
            const previousDate = new Date(previousWeekStartDate);
            previousDate.setDate(previousWeekStartDate.getDate() + i);
            previousWeekDates.push(`${previousDate.getMonth() + 1}/${previousDate.getDate()} (${dayNames[previousDate.getDay()]})`);
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
            // data.json이 없을 경우 전체 주간에 대한 샘플 데이터 생성
            const initialData = {};
            [...previousWeekDates, ...currentWeekDates].forEach(date => {
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
        console.log('데이터가 로컬 저장소에 저장되지 않습니다. 내보내기 기능을 사용하세요.');
    };

    // --- 데이터 내보내기 ---
    exportDataBtn.addEventListener('click', () => {
        const jsonString = JSON.stringify(allBoardData, null, 2); // 전체 데이터 내보내기
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'data.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    });

    // --- 보드 렌더링 ---
    const renderBoards = (boardData) => {
        allBoardData = boardData; // 전체 데이터 업데이트

        // 이번 주 보드 렌더링
        currentWeekBoard.innerHTML = '';
        currentWeekDates.forEach(date => {
            const column = createColumn(date, boardData, true); // isCurrentWeek = true
            currentWeekBoard.appendChild(column);
        });

        // 지난 주 보드 렌더링
        previousWeekBoard.innerHTML = '';
        previousWeekDates.forEach(date => {
            const column = createColumn(date, boardData, false); // isCurrentWeek = false
            previousWeekBoard.appendChild(column);
        });
    };

    // --- 컬럼 및 카드 생성 ---
    const createColumn = (date, boardData, isCurrentWeek) => {
        const column = document.createElement('div');
        column.className = 'column';
        column.dataset.date = date;
        if (!isCurrentWeek) {
            column.classList.add('past-week-column'); // 지난 주 컬럼에 클래스 추가
        }

        column.innerHTML = `
            <div class="column-title">${date}</div>
            <div class="card-list"></div>
            ${isCurrentWeek ? '<button class="add-card-btn">+ 카드 추가</button>' : ''}
        `;
        
        const cardList = column.querySelector('.card-list');
        if (boardData[date]) {
            boardData[date].forEach(cardData => cardList.appendChild(createCard(cardData, isCurrentWeek)));
        }

        if (isCurrentWeek) {
            column.querySelector('.add-card-btn').addEventListener('click', () => addCard(date));
            column.addEventListener('dragover', handleDragOver);
            column.addEventListener('dragleave', handleDragLeave);
            column.addEventListener('drop', (e) => handleDrop(e, date));
        }
        return column;
    };

    const createCard = (cardData, isCurrentWeek) => {
        const card = document.createElement('div');
        card.className = 'card';
        card.draggable = isCurrentWeek; // 이번 주 카드만 드래그 가능
        card.dataset.id = cardData.id;

        card.innerHTML = `
            <div class="card-title">${cardData.title}</div>
            <div class="card-description">${cardData.description}</div>
            ${isCurrentWeek ? '<button class="delete-card">&times;</button>' : ''}
        `;

        if (isCurrentWeek) {
            card.querySelector('.delete-card').addEventListener('click', (e) => {
                e.stopPropagation();
                deleteCard(cardData.id);
            });

            // 인라인 편집 이벤트 리스너 추가
            card.querySelector('.card-title').addEventListener('click', (e) => handleEdit(e.target, cardData.id, 'title'));
            card.querySelector('.card-description').addEventListener('click', (e) => handleEdit(e.target, cardData.id, 'description'));
        }

        card.addEventListener('dragstart', handleDragStart);
        if (isCurrentWeek) {
            card.addEventListener('dragend', handleDragEnd);
        }
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
            // allBoardData를 직접 수정
            for (const date in allBoardData) {
                const card = allBoardData[date].find(c => c.id === cardId);
                if (card) {
                    card[field] = newText || currentText; 
                    break;
                }
            }
            renderBoards(allBoardData); // 변경된 데이터로 다시 렌더링
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
        
        if (!allBoardData[date]) {
            allBoardData[date] = [];
        }
        allBoardData[date].push(newCard);
        renderBoards(allBoardData);
    };

    const deleteCard = (cardId) => {
        if (!confirm('정말로 이 카드를 삭제하시겠습니까?')) return;
        for (const date in allBoardData) {
            allBoardData[date] = allBoardData[date].filter(c => c.id !== cardId);
        }
        renderBoards(allBoardData);
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
        for (const date in allBoardData) {
            const cardIndex = allBoardData[date].findIndex(c => c.id === draggedCardId);
            if (cardIndex > -1) {
                [draggedCard] = allBoardData[date].splice(cardIndex, 1);
                break;
            }
        }
        if (draggedCard) {
            if (!allBoardData[targetDate]) {
                allBoardData[targetDate] = [];
            }
            allBoardData[targetDate].push(draggedCard);
            renderBoards(allBoardData);
        }
    };

    // --- 초기화 ---
    const initialize = async () => {
        setupWeekDates();
        const boardData = await loadData(); // 비동기 로드
        const savedTheme = localStorage.getItem('kanbanTheme') || 'light';
        applyTheme(savedTheme);
        renderBoards(boardData);
    };

    initialize();
});