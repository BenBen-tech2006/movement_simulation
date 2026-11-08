
(() => {
  'use strict';

  // =========================================================
  // 1. LẤY CÁC PHẦN TỬ HTML
  // =========================================================
  const canvas = document.getElementById('view');

  if (!canvas) {
    console.error('[3D Box] Không tìm thấy canvas #view');
    return;
  }

  const ctx = canvas.getContext('2d');

  if (!ctx) {
    console.error('[3D Box] Trình duyệt không hỗ trợ Canvas 2D');
    return;
  }

  const $ = (selector) => document.querySelector(selector);
  const byId = (id) => document.getElementById(id);

  const requiredIds = [
    'coords', 'angles', 'status', 'toast',
    'selected', 'locked', 'free',
    'step', 'minus', 'plus', 'reset'
  ];

  const missingIds = requiredIds.filter(id => !byId(id));

  if (missingIds.length > 0) {
    console.error(
      '[3D Box] Thiếu phần tử HTML:',
      missingIds.join(', ')
    );
    return;
  }

  // =========================================================
  // 2. TRẠNG THÁI MÔ PHỎNG
  // =========================================================

  const state = {
    p: [0, 0, 0], // Vị trí X, Y, Z
    r: [0, 0, 0]  // Góc xoay Rx, Ry, Rz
  };

  const camera = {
    yaw: -0.65,
    pitch: 0.48,
    zoom: 1
  };

  // Các biến này sẽ thay đổi trong quá trình tương tác.
  let selectedAxis = 'free';
  let rotateAxis = null;
  let drag = null;
  let toastTimer = null;

  const colors = {
    x: '#ff6378',
    y: '#43d5a5',
    z: '#58a7ff'
  };

  // =========================================================
  // 3. PHÉP CHIẾU TỌA ĐỘ 3D
  // =========================================================

  function project(point) {
    const cosYaw = Math.cos(camera.yaw);
    const sinYaw = Math.sin(camera.yaw);
    const cosPitch = Math.cos(camera.pitch);
    const sinPitch = Math.sin(camera.pitch);

    const rotatedX =
      point[0] * cosYaw - point[1] * sinYaw;

    const rotatedY =
      point[0] * sinYaw + point[1] * cosYaw;

    return [
      rotatedX,
      rotatedY * cosPitch + point[2] * sinPitch,
      -rotatedY * sinPitch + point[2] * cosPitch
    ];
  }

  function worldToScreen(point) {
    const rect = canvas.getBoundingClientRect();
    const projected = project(point);

    const scale =
      Math.min(rect.width, rect.height) *
      0.15 * camera.zoom;

    return [
      rect.width * 0.51 + projected[0] * scale,
      rect.height * 0.53 - projected[1] * scale,
      projected[2]
    ];
  }

  // =========================================================
  // 4. BIẾN ĐỔI ĐỈNH KHỐI HỘP
  // =========================================================

  function transformVertex(point) {
    const [x, y, z] = point;

    const ax = state.r[0] * Math.PI / 180;
    const ay = state.r[1] * Math.PI / 180;
    const az = state.r[2] * Math.PI / 180;

    // Xoay quanh trục X
    const y1 =
      y * Math.cos(ax) - z * Math.sin(ax);

    const z1 =
      y * Math.sin(ax) + z * Math.cos(ax);

    // Xoay quanh trục Y
    const x2 =
      x * Math.cos(ay) + z1 * Math.sin(ay);

    const z2 =
      -x * Math.sin(ay) + z1 * Math.cos(ay);

    // Xoay quanh trục Z
    const x3 =
      x2 * Math.cos(az) - y1 * Math.sin(az);

    const y3 =
      x2 * Math.sin(az) + y1 * Math.cos(az);

    // Cộng vị trí của khối hộp
    return [
      x3 + state.p[0],
      y3 + state.p[1],
      z2 + state.p[2]
    ];
  }

  // =========================================================
  // 5. CẬP NHẬT TỌA ĐỘ VÀ GÓC XOAY
  // =========================================================

  function updateReadout() {
    byId('coords').textContent =
      `X ${state.p[0].toFixed(2)}   ` +
      `Y ${state.p[1].toFixed(2)}   ` +
      `Z ${state.p[2].toFixed(2)}`;

    byId('angles').textContent =
      `Góc xoay: X ${Math.round(state.r[0])}° · ` +
      `Y ${Math.round(state.r[1])}° · ` +
      `Z ${Math.round(state.r[2])}°`;
  }

  function say(message) {
    byId('status').textContent = message;

    const toast = byId('toast');

    toast.textContent = message;
    toast.classList.add('show');

    clearTimeout(toastTimer);

    toastTimer = setTimeout(() => {
      toast.classList.remove('show');
    }, 1400);
  }

  // =========================================================
  // 6. VẼ KHÔNG GIAN 3D
  // =========================================================

  function draw() {
    const rect = canvas.getBoundingClientRect();
    const pixelRatio = window.devicePixelRatio || 1;

    if (!rect.width || !rect.height) return;

    const targetWidth =
      Math.round(rect.width * pixelRatio);

    const targetHeight =
      Math.round(rect.height * pixelRatio);

    if (
      canvas.width !== targetWidth ||
      canvas.height !== targetHeight
    ) {
      canvas.width = targetWidth;
      canvas.height = targetHeight;
    }

    ctx.setTransform(
      pixelRatio, 0, 0,
      pixelRatio, 0, 0
    );

    ctx.clearRect(0, 0, rect.width, rect.height);

    // Hàm vẽ đa giác
    function drawPolygon(points, fill, stroke) {
      ctx.beginPath();

      points.forEach((point, index) => {
        const p = worldToScreen(point);

        if (index === 0) {
          ctx.moveTo(p[0], p[1]);
        } else {
          ctx.lineTo(p[0], p[1]);
        }
      });

      ctx.closePath();
      ctx.fillStyle = fill;
      ctx.fill();

      ctx.strokeStyle = stroke;
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Mặt phẳng XY
    const floor = [
      [-8, -8, -0.7],
      [8, -8, -0.7],
      [8, 8, -0.7],
      [-8, 8, -0.7]
    ];

    drawPolygon(
      floor,
      '#1b294a70',
      '#4c5b7c66'
    );

    // Vẽ lưới
    for (let i = -8; i <= 8; i++) {
      const segments = [
        [[i, -8, -0.68], [i, 8, -0.68]],
        [[-8, i, -0.68], [8, i, -0.68]]
      ];

      segments.forEach(segment => {
        const a = worldToScreen(segment[0]);
        const b = worldToScreen(segment[1]);

        ctx.beginPath();
        ctx.moveTo(a[0], a[1]);
        ctx.lineTo(b[0], b[1]);

        ctx.strokeStyle = '#9aafd31d';
        ctx.stroke();
      });
    }

    // Ba trục tọa độ
    const axes = [
      ['x', [5, 0, 0]],
      ['y', [0, 5, 0]],
      ['z', [0, 0, 4]]
    ];

    axes.forEach(([axis, endpoint]) => {
      const origin = worldToScreen([0, 0, 0]);
      const end = worldToScreen(endpoint);

      ctx.beginPath();
      ctx.moveTo(origin[0], origin[1]);
      ctx.lineTo(end[0], end[1]);

      ctx.strokeStyle = colors[axis];
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(end[0], end[1], 4, 0, Math.PI * 2);

      ctx.fillStyle = colors[axis];
      ctx.fill();

      ctx.fillStyle = colors[axis];
      ctx.font = 'bold 14px Segoe UI';

      ctx.fillText(
        axis.toUpperCase(),
        end[0] + 8,
        end[1] - 8
      );
    });

    // Tám đỉnh khối hộp
    const rawVertices = [
      [-1, -0.75, -0.62],
      [1, -0.75, -0.62],
      [-1, 0.75, -0.62],
      [1, 0.75, -0.62],
      [-1, -0.75, 0.62],
      [1, -0.75, 0.62],
      [-1, 0.75, 0.62],
      [1, 0.75, 0.62]
    ];

    const vertices = rawVertices.map(transformVertex);

    // Các mặt khối hộp
    const faces = [
      [[0, 2, 3, 1], '#b96b2e'],
      [[0, 1, 5, 4], '#ffbd70'],
      [[0, 4, 6, 2], '#d57b35'],
      [[4, 5, 7, 6], '#f0a34f']
    ];

    faces.forEach(([indices, color]) => {
      drawPolygon(
        indices.map(index => vertices[index]),
        color,
        '#ffe0ad'
      );
    });

    // Mười hai cạnh
    const edges = [
      [0, 1], [0, 2], [0, 4],
      [1, 3], [1, 5],
      [2, 3], [2, 6],
      [3, 7],
      [4, 5], [4, 6],
      [5, 7], [6, 7]
    ];

    edges.forEach(([start, end]) => {
      const a = worldToScreen(vertices[start]);
      const b = worldToScreen(vertices[end]);

      ctx.beginPath();
      ctx.moveTo(a[0], a[1]);
      ctx.lineTo(b[0], b[1]);

      ctx.strokeStyle = '#ffe3b8';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    });

    // Tâm khối hộp
    const center = worldToScreen(state.p);

    ctx.beginPath();
    ctx.arc(center[0], center[1], 5, 0, Math.PI * 2);

    ctx.fillStyle = '#ffffff';
    ctx.fill();

    ctx.strokeStyle = '#121a2d';
    ctx.lineWidth = 3;
    ctx.stroke();

    updateReadout();
  }

  // =========================================================
  // 7. CHỌN TRỤC DI CHUYỂN
  // =========================================================

  function updateModeButtons() {
    byId('free').classList.toggle(
      'on',
      selectedAxis === 'free' && rotateAxis === null
    );

    byId('locked').classList.toggle(
      'on',
      selectedAxis !== 'free' && rotateAxis === null
    );
  }

  function selectAxis(axis) {
    selectedAxis = axis;
    rotateAxis = null;

    document.querySelectorAll('[data-axis]').forEach(button => {
      button.classList.toggle(
        'on',
        button.dataset.axis === axis
      );
    });

    document.querySelectorAll('[data-rot]').forEach(button => {
      button.classList.remove('on');
    });

    byId('selected').textContent =
      axis === 'free'
        ? 'Tự do · XY (Z chọn riêng)'
        : `Trục ${axis.toUpperCase()}`;

    updateModeButtons();

    say(
      axis === 'free'
        ? 'Đã chọn di chuyển tự do trên mặt phẳng XY'
        : `ĐÃ CHỌN TRỤC ${axis.toUpperCase()} · KÉO CHUỘT HOẶC BẤM +/−`
    );
  }

  // =========================================================
  // 8. CHỌN TRỤC XOAY
  // =========================================================

  function selectRotation(axis) {
    rotateAxis = axis;
    selectedAxis = 'free';

    document.querySelectorAll('[data-rot]').forEach(button => {
      button.classList.toggle(
        'on',
        button.dataset.rot === axis
      );
    });

    document.querySelectorAll('[data-axis]').forEach(button => {
      button.classList.remove('on');
    });

    byId('selected').textContent =
      `Xoay quanh ${axis.toUpperCase()}`;

    updateModeButtons();

    say(
      `ĐÃ CHỌN XOAY ${axis.toUpperCase()} · KÉO CHUỘT NGANG TRONG VÙNG MÔ PHỎNG`
    );
  }

  // Các nút chọn trục di chuyển X, Y, Z
  document.querySelectorAll('[data-axis]').forEach(button => {
    button.addEventListener('click', () => {
      selectAxis(button.dataset.axis);
    });
  });

  // Các nút xoay
  document.querySelectorAll('[data-rot]').forEach(button => {
    button.addEventListener('click', () => {
      selectRotation(button.dataset.rot);
    });
  });

  // Chế độ tự do
  byId('free').addEventListener('click', () => {
    selectAxis('free');
  });

  // Chế độ khóa trục
  byId('locked').addEventListener('click', () => {
    if (selectedAxis === 'free') {
      selectAxis('x');
    } else {
      updateModeButtons();

      say(
        `Đang khóa theo trục ${selectedAxis.toUpperCase()}`
      );
    }
  });

  // =========================================================
  // 9. DI CHUYỂN BẰNG NÚT + VÀ -
  // =========================================================

  function stepMove(direction) {
    if (selectedAxis === 'free') {
      say('Hãy chọn trục X, Y hoặc Z trước khi dùng nút +/−');
      return;
    }

    const axisIndex = 'xyz'.indexOf(selectedAxis);

    const inputStep = Number(byId('step').value);

    const step =
      Number.isFinite(inputStep) && inputStep > 0
        ? Math.max(0.05, inputStep)
        : 0.25;

    state.p[axisIndex] = Math.max(
      -5,
      Math.min(
        5,
        state.p[axisIndex] + direction * step
      )
    );

    draw();

    say(
      `Đã dịch chuyển theo trục ${selectedAxis.toUpperCase()}`
    );
  }

  byId('minus').addEventListener('click', () => {
    stepMove(-1);
  });

  byId('plus').addEventListener('click', () => {
    stepMove(1);
  });

  // =========================================================
  // 10. RESET KHỐI HỘP
  // =========================================================

  byId('reset').addEventListener('click', () => {
    state.p = [0, 0, 0];
    state.r = [0, 0, 0];

    selectAxis('free');

    draw();

    say('Đã đặt lại khối hộp');
  });

  // =========================================================
  // 11. BẮT ĐẦU KÉO CHUỘT
  // =========================================================

  canvas.addEventListener('pointerdown', event => {
    // Chuột trái: thao tác vật thể.
    // Chuột phải: xoay góc nhìn.
    if (event.button !== 0 && event.button !== 2) {
      return;
    }

    const rect = canvas.getBoundingClientRect();

    drag = {
      pointerId: event.pointerId,

      startX: event.clientX - rect.left,
      startY: event.clientY - rect.top,

      startPosition: [...state.p],
      startRotation: [...state.r],

      startYaw: camera.yaw,
      startPitch: camera.pitch,

      mode:
        event.button === 2
          ? 'camera'
          : rotateAxis
            ? 'rotate'
            : 'move',

      axis: selectedAxis,
      rotationAxis: rotateAxis
    };

    canvas.setPointerCapture(event.pointerId);

    if (drag.mode === 'camera') {
      say('Đang xoay góc nhìn · thả chuột phải để kết thúc');
    } else if (drag.mode === 'rotate') {
      say(`Đang xoay quanh trục ${drag.rotationAxis.toUpperCase()}`);
    } else {
      say(
        drag.axis === 'free'
          ? 'Đang di chuyển trên mặt phẳng XY'
          : `Đang di chuyển theo trục ${drag.axis.toUpperCase()}`
      );
    }
  });

  canvas.addEventListener('contextmenu', event => {
    event.preventDefault();
  });

  // =========================================================
  // 12. DI CHUYỂN CHUỘT
  // =========================================================

  canvas.addEventListener('pointermove', event => {
    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }

    const rect = canvas.getBoundingClientRect();

    const currentX = event.clientX - rect.left;
    const currentY = event.clientY - rect.top;

    const dx = currentX - drag.startX;
    const dy = currentY - drag.startY;

    const scale =
      Math.min(rect.width, rect.height) *
      0.15 * camera.zoom;

    if (!scale) return;

    // -------------------------------------------------------
    // A. Xoay camera bằng chuột phải
    // -------------------------------------------------------

    if (drag.mode === 'camera') {
      camera.yaw =
        drag.startYaw + dx * 0.008;

      camera.pitch = Math.max(
        -1.25,
        Math.min(
          1.25,
          drag.startPitch + dy * 0.008
        )
      );
    }

    // -------------------------------------------------------
    // B. Xoay khối hộp quanh X, Y hoặc Z
    // -------------------------------------------------------

    else if (drag.mode === 'rotate') {
      const axisIndex =
        'xyz'.indexOf(drag.rotationAxis);

      if (axisIndex < 0) return;

      state.r[axisIndex] =
        drag.startRotation[axisIndex] + dx * 0.7;
    }

    // -------------------------------------------------------
    // C. Di chuyển tự do trên mặt phẳng XY
    // -------------------------------------------------------

    else if (drag.axis === 'free') {
      const projectedX = project([1, 0, 0]);
      const projectedY = project([0, 1, 0]);

      const screenDx = dx / scale;
      const screenDy = -dy / scale;

      const determinant =
        projectedX[0] * projectedY[1] -
        projectedY[0] * projectedX[1];

      if (Math.abs(determinant) > 1e-8) {
        const moveX = (
          screenDx * projectedY[1] -
          projectedY[0] * screenDy
        ) / determinant;

        const moveY = (
          projectedX[0] * screenDy -
          screenDx * projectedX[1]
        ) / determinant;

        state.p[0] = drag.startPosition[0] + moveX;
        state.p[1] = drag.startPosition[1] + moveY;
      }
    }

    // -------------------------------------------------------
    // D. Khóa di chuyển theo trục X, Y hoặc Z
    // -------------------------------------------------------

    else {
      const axis = drag.axis;

      const axisVector =
        axis === 'x'
          ? [1, 0, 0]
          : axis === 'y'
            ? [0, 1, 0]
            : [0, 0, 1];

      const projectedAxis = project(axisVector);

      const denominator =
        projectedAxis[0] ** 2 +
        projectedAxis[1] ** 2;

      if (denominator > 1e-8) {
        const amount = (
          dx * projectedAxis[0] -
          dy * projectedAxis[1]
        ) / (scale * denominator);

        const axisIndex = 'xyz'.indexOf(axis);

        state.p[axisIndex] =
          drag.startPosition[axisIndex] + amount;
      }
    }

    // Giới hạn tọa độ từ -5 đến 5
    state.p = state.p.map(value =>
      Math.max(-5, Math.min(5, value))
    );

    draw();
  });

  // =========================================================
  // 13. KẾT THÚC KÉO CHUỘT
  // =========================================================

  function endDrag(event) {
    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }

    drag = null;

    say('Thao tác đã cập nhật');
  }

  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);
  canvas.addEventListener('lostpointercapture', endDrag);

  // =========================================================
  // 14. ZOOM BẰNG CON LĂN CHUỘT
  // =========================================================

  canvas.addEventListener('wheel', event => {
    event.preventDefault();

    const factor =
      event.deltaY > 0 ? 0.92 : 1.08;

    camera.zoom = Math.max(
      0.55,
      Math.min(1.8, camera.zoom * factor)
    );

    draw();
  }, { passive: false });

  // =========================================================
  // 15. CẬP NHẬT KHI THAY ĐỔI KÍCH THƯỚC MÀN HÌNH
  // =========================================================

  window.addEventListener('resize', draw);

  // =========================================================
  // 16. KHỞI TẠO ỨNG DỤNG
  // =========================================================

  updateModeButtons();
  draw();

  console.info(
    '[3D Box] app.js đã tải và đăng ký sự kiện thành công.'
  );

})();
