import { useState, useEffect } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from './assets/vite.svg'
import heroImg from './assets/hero.png'
import './App.css'

const MOCK_DATA = [];

// 로컬 스토리지에서 username -> userId 맵 로드/저장 헬퍼
const getLocalUserMap = () => {
  try {
    const saved = localStorage.getItem('setlog_user_map');
    return saved ? JSON.parse(saved) : {};
  } catch (e) {
    return {};
  }
};

const saveLocalUserMap = (map) => {
  try {
    localStorage.setItem('setlog_user_map', JSON.stringify(map));
  } catch (e) {}
};

// 사용 가능한 전체 유저 목록을 획득하는 헬퍼 (게시물이 생성된 유저 + 캐싱된 유저)
const getAllAvailableUsers = (postData) => {
  const users = [];
  if (Array.isArray(postData)) {
    postData.forEach(u => {
      if (u && u.id) {
        users.push({ id: u.id, user_name: u.user_name });
      }
    });
  }
  const localMap = getLocalUserMap();
  Object.entries(localMap).forEach(([name, id]) => {
    if (!users.some(u => String(u.id) === String(id))) {
      users.push({ id: id, user_name: name });
    }
  });
  return users;
};

// 서버로부터 실시간 포스트 목록을 갱신하는 공통 헬퍼
const refreshPosts = (setPostData) => {
  fetch('/api/posts')
    .then((response) => {
      if (!response.ok) throw new Error();
      return response.json();
    })
    .then((data) => {
      setPostData(parseServerPosts(data));
    })
    .catch((err) => {
      console.log("서버 데이터 갱신 실패:", err);
    });
};

// 서버에서 받아온 플랫한 posts 배열을 유저별 컬럼 그룹 데이터로 파싱 및 그룹화하는 유틸리티
const parseServerPosts = (data) => {
  if (!Array.isArray(data)) return [];
  
  // 데이터가 MOCK_DATA와 같은 그룹화된 구조인 경우 그대로 리턴
  if (data.length > 0 && 'posts' in data[0] && Array.isArray(data[0].posts)) {
    return data;
  }

  const userMap = getLocalUserMap();
  const grouped = [];
  data.forEach((post) => {
    // 1. 유저 ID 및 이름 추출 (다양한 백엔드 규격 쉴드 처리)
    const uName = post.username || post.nickname || (post.user && post.user.nickname) || post.user_name || 'unknown_user';
    // 백엔드 미수정 사양 대응: post.userId가 없을 경우 로컬 캐시 맵에서 조회하거나 사용자명을 임시 ID로 씁니다.
    const uId = post.userId || userMap[uName] || uName;

    let userGroup = grouped.find((g) => String(g.id) === String(uId) || g.user_name === uName);
    if (!userGroup) {
      userGroup = {
        id: uId,
        user_name: uName,
        posts: []
      };
      grouped.push(userGroup);
    }

    // 2. 시간대 데이터 포맷팅 복원 (T22 -> 22:00)
    let displayTime = post.time || '00:00';
    if (typeof displayTime === 'string' && displayTime.startsWith('T')) {
      const hour = displayTime.substring(1);
      displayTime = `${hour.padStart(2, '0')}:00`;
    }

    userGroup.posts.push({
      id: post.id,
      time: displayTime,
      content: post.content,
      tag: post.tags || post.tag || []
    });
  });

  return grouped;
};

function usePostData() {
  const [postData, setPostData] = useState([]);

  useEffect(() => {
    fetch('/api/posts')
      .then((response) => {
        if (!response.ok) {
          throw new Error(`HTTP Error: ${response.status}`);
        }
        return response.json();
      })
      .catch((error) => {
        console.log('데이터를 불러올 수 없습니다:', error);
        return [];
      })
      .then((data) => {
        // 서버의 플랫한 응답을 뷰에 맞춤 그룹화 파싱
        setPostData(parseServerPosts(data));
      });
  }, []);

  return [postData, setPostData]; // 최종적으로 받아온 데이터와 업데이트 함수를 배열로 반환합니다.
}

function App() {
  // 밖으로 빼낸 커스텀 훅을 호출하여 데이터와 업데이트 함수를 받아옵니다.
  const [postData, setPostData] = usePostData();

  // 모달(팝업)의 열림/닫힘 상태를 관리합니다.
  const [isModalOpen, setIsModalOpen] = useState(false);

  // 유저 생성 모달 상태
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);

  // 수정할 게시글 ID 상태
  const [editingPostId, setEditingPostId] = useState(null);

  // 태그 검색어 상태
  const [searchTag, setSearchTag] = useState('');

  // 태그로 검색하는 함수
  const handleTagSearch = () => {
    if (!searchTag.trim()) {
      // 검색어가 비어있으면 전체 데이터 다시 불러오기
      refreshPosts(setPostData);
      return;
    }

    // 태그 기반으로 서버에 검색 요청
    fetch(`/api/posts/search?tag=${searchTag}`)
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
        return response.json();
      })
      .catch((error) => {
        console.log('태그 검색 실패:', error);
        return [];
      })
      .then((data) => setPostData(parseServerPosts(data)));
  };

  return (
    <>
      <section id="center">
        {/* 로고 영역 */}
        <div className="logo-wrapper">
          <img src="/OurLog.png" alt="OurLog Logo" className="logo-image" />
        </div>

        {/* 컨트롤바 영역 (버튼 및 검색창 한 줄 배치) */}
        <div className="control-bar">
          {/* 버튼 영역 */}
          <div className="create-post-btn-wrapper">
            <button className="create-user-btn" onClick={() => setIsUserModalOpen(true)}>
              + User
            </button>
            <button className="create-post-btn" onClick={() => setIsModalOpen(true)}>
              + Post
            </button>
          </div>

          {/* 태그 검색 영역 */}
          <div className="tag-search-area">
            <input
              type="text"
              value={searchTag}
              onChange={(e) => setSearchTag(e.target.value)}
              placeholder="태그로 검색하세요 (예: 개발)"
              className="tag-search-input"
              onKeyDown={(e) => { if (e.key === 'Enter') handleTagSearch(); }}
            />
            <button onClick={handleTagSearch} className="tag-search-btn">검색</button>
          </div>
        </div>

        {/* isModalOpen이 true일 때만 게시글 모달 렌더링 */}
        {isModalOpen && (
          <PostCreateModal onClose={() => setIsModalOpen(false)} setPostData={setPostData} postData={postData} />
        )}

        {/* isUserModalOpen이 true일 때만 유저 모달 렌더링 */}
        {isUserModalOpen && (
          <UserCreateModal onClose={() => setIsUserModalOpen(false)} setPostData={setPostData} />
        )}

        {/* editingPostId가 null이 아닐 때만 게시글 수정 모달 렌더링 */}
        {editingPostId !== null && (
          <PostEditModal postId={editingPostId} onClose={() => setEditingPostId(null)} setPostData={setPostData} postData={postData} />
        )}

        {/* 여러 명의 PostList를 가로로 배치하기 위해 flex 적용 */}
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '20px', marginTop: '20px' }}>
          {postData.map((userData, index) => (
            <PostList key={userData.id} {...userData} onCardClick={setEditingPostId} isFirst={index === 0} isLast={index === postData.length - 1} />
          ))}
        </div>
      </section>
    </>
  )
}
function Card(post) {
  return (
    <div className="post-card" onClick={() => post.onCardClick(post.id)}>
      <h1>
        {post.time}
      </h1>

      <p>
        {post.content}
      </p>

      {post.tag && post.tag.length > 0 && (
        <div className="tag-list" onClick={() => post.onCardClick(post.id)}>
          {post.tag.map((t) => (
            <span key={t} className="tag">{t}</span>
          ))}
        </div>
      )}
    </div>
  )
}

function PostList(userObject) {
  return (
    <div className="post-list-container">
      {userObject.isFirst && (
        <>
          <img 
            src="/back1.png" 
            alt="decorator sticker 2" 
            className="back1-decorator-image"
          />
          <img 
            src="/back.png" 
            alt="decorator sticker" 
            className="back-decorator-image"
          />
        </>
      )}
      {userObject.isLast && (
        <img 
          src="/back2.png" 
          alt="decorator sticker 3" 
          className="back2-decorator-image"
        />
      )}
      <div className="post-list-title-wrapper">
        <h3 className="post-list-title">
          {userObject.user_name}
        </h3>
      </div>

      <div className="post-list-scroll-area">
        {userObject.posts.map((post) => (
          <Card key={post.id} {...post} onCardClick={userObject.onCardClick} />
        ))}
      </div>
    </div>
  )
}

// 새로운 팝업(모달) 뼈대 컴포넌트
function PostCreateModal({ onClose, setPostData, postData }) {
  const availableUsers = getAllAvailableUsers(postData);
  // 사용자가 입력할 내용을 담을 상태 (텍스트 대신 드롭다운 선택값 사용)
  const [selectedUserId, setSelectedUserId] = useState(availableUsers.length > 0 ? availableUsers[0].id : '');
  const [content, setContent] = useState('');
  const [time, setTime] = useState('');
  const [tag, setTag] = useState('');

  // 생성 버튼을 눌렀을 때 실행될 함수
  const handleSubmit = () => {
    // 값이 비어있는지 간단한 유효성 검사
    if (!selectedUserId || !content || !time) {
      alert("유저 선택, 시간, 내용을 모두 입력해주세요!");
      return;
    }

    // 선택한 유저 이름 가져오기
    const selectedUser = availableUsers.find(u => u.id === selectedUserId || String(u.id) === String(selectedUserId));
    const selectedUserName = selectedUser ? selectedUser.user_name : '';

    const executePostCreation = (numericUserId) => {
      // 서버로 전송하기 위해 준비된 데이터 객체 (userId로 변경, 백엔드 규격 timeSlot 준수)
      const requestBody = {
        userId: Number(numericUserId),
        timeSlot: time ? `T${time.split(':')[0]}` : '',
        content: content,
        tags: tag.trim().split(/\s+/).filter(t => t !== '') // 태그를 배열 형태로 파싱
      };

      // 전송 직전 alert으로 객체 데이터 포맷을 정돈하여 보여줍니다.
      alert("서버 전송 예정 데이터:\n" + JSON.stringify(requestBody, null, 2));

      // API로 서버에 게시글 생성 요청
      fetch('/api/posts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      })
        .then((response) => {
          response.clone().text().then((text) => {
            alert("서버 응답 전문:\n" + text);
          });
          if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
          return response.json();
        })
        .then((data) => {
          alert("게시글이 서버에 성공적으로 등록되었습니다!");
          refreshPosts(setPostData);
          onClose();
        })
        .catch((error) => {
          console.log('서버에 게시글 생성 실패:', error.message);
          alert("서버 연결에 실패하여 게시글을 등록할 수 없습니다.");
          onClose();
        });
    };

    // 만약 selectedUserId가 숫자가 아닌 문자열 이름인 경우 (백엔드 미수정 대비 자동 등록 처리)
    if (isNaN(Number(selectedUserId))) {
      fetch('/api/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: selectedUserName || selectedUserId
        })
      })
        .then(res => {
          if (!res.ok) throw new Error();
          return res.json();
        })
        .then(data => {
          const realId = data.id;
          const currentMap = getLocalUserMap();
          currentMap[selectedUserName || selectedUserId] = realId;
          saveLocalUserMap(currentMap);

          executePostCreation(realId);
        })
        .catch(() => {
          alert("유저 정보 자동 등록에 실패하여 서버에 글을 쓸 수 없습니다.");
        });
    } else {
      executePostCreation(selectedUserId);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h2>새 게시글 작성</h2>

        <div className="input-group">
          <label>이름 (유저 선택)</label>
          <select
            value={selectedUserId}
            onChange={(e) => setSelectedUserId(e.target.value)}
          >
            <option value="">글을 작성할 유저를 선택하세요</option>
            {availableUsers.map((user) => (
              <option key={user.id} value={user.id}>
                {user.user_name}
              </option>
            ))}
          </select>
          {availableUsers.length === 0 && (
            <span style={{ fontSize: '11px', color: '#ff4d4f', marginTop: '2px' }}>
              * 등록된 유저가 없습니다. 왼쪽 상단의 +user 버튼으로 유저를 먼저 등록해 주세요!
            </span>
          )}
        </div>

        <div className="input-group">
          <label>시간</label>
          <select
            value={time}
            onChange={(e) => setTime(e.target.value)}
          >
            <option value="">시간을 선택하세요</option>
            {Array.from({ length: 24 }, (_, i) => (
              <option key={i} value={`${String(i).padStart(2, '0')}:00`}>
                {i}시
              </option>
            ))}
          </select>
        </div>

        <div className="input-group">
          <label>내용</label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="내용을 입력하세요"
          />
        </div>

        <div className="input-group">
          <label>태그</label>
          <input
            type="text"
            value={tag}
            onChange={(e) => setTag(e.target.value)}
            placeholder="태그를 입력하세요"
          />
        </div>

        <div className="modal-actions">
          <button onClick={onClose} className="cancel-btn">취소</button>
          <button onClick={handleSubmit} className="submit-btn">생성</button>
        </div>
      </div>
    </div>
  );
}

export default App

// 유저 생성 모달 컴포넌트
function UserCreateModal({ onClose, setPostData }) {
  const [userName, setUserName] = useState('');

  const handleSubmit = () => {
    if (!userName.trim()) {
      alert("유저 이름을 입력해주세요!");
      return;
    }

    // API로 서버에 유저 생성 요청
    fetch('/api/users', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username: userName, // 백엔드 UserRequestDTO 규격에 맞춰 username으로 변경
      }),
    })
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
        return response.json();
      })
      .then((data) => {
        console.log('서버 유저 생성 완료:', data);
        
        // 서버에서 생성해준 실제 id 수집
        const realId = data.id || `user_${Date.now()}`;
        const realName = data.username || data.nickname || data.user_name || userName;

        // 로컬 유저 고유 ID 매핑 업데이트
        const currentMap = getLocalUserMap();
        currentMap[realName] = realId;
        saveLocalUserMap(currentMap);

        // 화면 갱신 및 팝업 닫기
        refreshPosts(setPostData);
        alert(`유저 "${realName}"이(가) 등록되었습니다! (ID: ${realId})`);
        onClose();
      })
      .catch((error) => {
        console.log('유저 생성 실패:', error.message);
        alert("유저 생성에 실패했습니다.");
        onClose();
      });
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h2>유저 생성</h2>

        <div className="input-group">
          <label>이름</label>
          <input
            type="text"
            value={userName}
            onChange={(e) => setUserName(e.target.value)}
            placeholder="유저 이름을 입력하세요"
            onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit(); }}
          />
        </div>

        <div className="modal-actions">
          <button onClick={onClose} className="cancel-btn">취소</button>
          <button onClick={handleSubmit} className="submit-btn">생성</button>
        </div>
      </div>
    </div>
  );
}

// 게시글 수정 및 삭제를 지원하는 모달 컴포넌트
function PostEditModal({ postId, onClose, setPostData, postData }) {
  const availableUsers = getAllAvailableUsers(postData);

  // 1. 초기값을 postData에서 직접 찾아 빠르게 로드
  let initialUserId = '';
  let initialContent = '';
  let initialTime = '';
  let initialTag = '';

  const foundUser = postData.find(u => u.posts.some(p => p.id === postId));
  if (foundUser) {
    initialUserId = foundUser.id;
    const foundPost = foundUser.posts.find(p => p.id === postId);
    if (foundPost) {
      initialContent = foundPost.content;
      initialTime = foundPost.time;
      initialTag = Array.isArray(foundPost.tag) ? foundPost.tag.join(' ') : (foundPost.tag || '');
    }
  }

  const [selectedUserId, setSelectedUserId] = useState(initialUserId);
  const [content, setContent] = useState(initialContent);
  const [time, setTime] = useState(initialTime);
  const [tag, setTag] = useState(initialTag);

  // 2. 마운트 시 서버 API에서 단일 게시물 데이터 fetch 시도
  useEffect(() => {
    fetch(`/api/posts/${postId}`)
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
        return response.json();
      })
      .then((data) => {
        // 서버에서 가져온 데이터 반영 (성공 시)
        if (data.userId) setSelectedUserId(data.userId);
        if (data.content) setContent(data.content);
        if (data.time) setTime(data.time);
        if (data.tags || data.tag) {
          const rawTags = data.tags || data.tag;
          setTag(Array.isArray(rawTags) ? rawTags.join(' ') : rawTags);
        }
      })
      .catch((error) => {
        console.log('단일 게시글 fetch 실패, 로컬 데이터를 유지합니다:', error.message);
      });
  }, [postId]);

  // 3. 수정 완료 처리 (PUT)
  const handleUpdate = () => {
    if (!selectedUserId || !content || !time) {
      alert("이름, 시간, 내용을 모두 입력해주세요!");
      return;
    }

    const updatedTags = tag.trim().split(/\s+/).filter(t => t !== '');
    const selectedUser = availableUsers.find(u => u.id === selectedUserId || String(u.id) === String(selectedUserId));
    const selectedUserName = selectedUser ? selectedUser.user_name : '';

    const executePostUpdate = (numericUserId) => {
      // 서버에 PUT 요청 시도
      fetch(`/api/posts/${postId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: Number(numericUserId),
          timeSlot: time ? `T${time.split(':')[0]}` : '',
          content: content,
          tags: updatedTags // 배열 형태로 파싱한 태그 전송
        }),
      })
        .then((response) => {
          if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
          return response.json();
        })
        .then((data) => {
          alert("게시글이 수정되었습니다!");
          refreshPosts(setPostData);
          onClose();
        })
        .catch((error) => {
          console.log('API 수정 호출 실패:', error.message);
          alert("수정에 실패했습니다.");
          onClose();
        });
    };

    // 만약 selectedUserId가 숫자가 아닌 문자열 이름인 경우 (백엔드 미수정 대비 자동 등록 처리)
    if (isNaN(Number(selectedUserId))) {
      fetch('/api/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: selectedUserName || selectedUserId
        })
      })
        .then(res => {
          if (!res.ok) throw new Error();
          return res.json();
        })
        .then(data => {
          const realId = data.id;
          const currentMap = getLocalUserMap();
          currentMap[selectedUserName || selectedUserId] = realId;
          saveLocalUserMap(currentMap);

          executePostUpdate(realId);
        })
        .catch(() => {
          alert("유저 정보 자동 등록에 실패하여 서버에서 글을 수정할 수 없습니다.");
        });
    } else {
      executePostUpdate(selectedUserId);
    }
  };

  // 4. 삭제 처리 (DELETE)
  const handleDelete = () => {
    if (!confirm("정말로 이 게시글을 삭제하시겠습니까?")) {
      return;
    }

    // 서버에 DELETE 요청 시도
    fetch(`/api/posts/${postId}`, {
      method: 'DELETE',
    })
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
        alert("게시글이 삭제되었습니다!");
        refreshPosts(setPostData);
        onClose();
      })
      .catch((error) => {
        console.log('API 삭제 호출 실패:', error.message);
        alert("삭제에 실패했습니다.");
        onClose();
      });
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h2>게시글 수정/삭제</h2>

        <div className="input-group">
          <label>이름 (유저 선택)</label>
          <select
            value={selectedUserId}
            onChange={(e) => setSelectedUserId(e.target.value)}
          >
            <option value="">글을 작성할 유저를 선택하세요</option>
            {availableUsers.map((user) => (
              <option key={user.id} value={user.id}>
                {user.user_name}
              </option>
            ))}
          </select>
        </div>

        <div className="input-group">
          <label>시간</label>
          <select
            value={time}
            onChange={(e) => setTime(e.target.value)}
          >
            <option value="">시간을 선택하세요</option>
            {Array.from({ length: 24 }, (_, i) => (
              <option key={i} value={`${String(i).padStart(2, '0')}:00`}>
                {i}시
              </option>
            ))}
          </select>
        </div>

        <div className="input-group">
          <label>내용</label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="내용을 입력하세요"
          />
        </div>

        <div className="input-group">
          <label>태그 (공백으로 구분)</label>
          <input
            type="text"
            value={tag}
            onChange={(e) => setTag(e.target.value)}
            placeholder="예: 개발 리액트"
          />
        </div>

        <div className="modal-actions" style={{ justifyContent: 'space-between' }}>
          <button onClick={handleDelete} className="delete-btn">삭제</button>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={onClose} className="cancel-btn">취소</button>
            <button onClick={handleUpdate} className="submit-btn">수정</button>
          </div>
        </div>
      </div>
    </div>
  );
}

