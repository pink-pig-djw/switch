"""
Switch 风格掌机 —— Blender 程序化建模脚本
================================================

按 Nintendo Switch（初代 HAC-001）公开的外形尺寸建模：
  整机（装上 Joy-Con）102 × 239 × 13.9 mm，摇杆顶端到 ZL/ZR 顶面 28.4 mm，6.2 英寸 16:9 屏幕。
所有部件（外壳、屏幕、每一颗按键、摇杆、肩键/扳机、滑轨、SL/SR、指示灯、接口、
散热孔、扬声器孔、支架、游戏卡槽盖、底座……）都由本脚本用 bmesh 生成，没有任何外部素材。

运行方式（二选一）：
  blender -b -P blender/build_switch.py
  python  blender/build_switch.py            # 需要 `pip install bpy`（Blender 作为 Python 模块）
可选参数（放在 `--` 之后或直接跟在脚本后面）：
  --render <目录>   额外用 Cycles 渲染几张预览图
  --no-blend        不保存 .blend 工程

输出：
  web/assets/switch.glb   网页查看器加载的模型（节点名 / extras 描述了可交互部件）
  blender/switch.blend    Blender 工程文件

坐标约定：Blender 单位 = 毫米；X 向右，Z 向上，正面朝 -Y。
glTF 导出时自动转换为 Y 向上（Blender (x, y, z) → glTF (x, z, -y)）。
"""

import math
import os
import sys
from math import cos, pi, radians, sin, sqrt

import bpy  # 必须先导入 bpy（作为 Python 模块使用时它负责初始化 bmesh / mathutils）
import bmesh
from mathutils import Matrix, Vector

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
OUT_GLB = os.path.join(ROOT, 'web', 'assets', 'switch.glb')
OUT_BLEND = os.path.join(HERE, 'switch.blend')

ARGV = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:]

# --------------------------------------------------------------------------
# 尺寸（mm）
# --------------------------------------------------------------------------
H = 102.0            # 高
D = 13.9             # 机身厚度
YF = -D / 2          # 正面 y
YB = D / 2           # 背面 y
CW = 173.0           # 主机（平板部分）宽
JW = 33.0            # 单只 Joy-Con 外露宽度（173 + 2×33 = 239）
XC = CW / 2          # 86.5
XJ = XC + JW         # 119.5
ZT = H / 2           # 51
RF = 1.1             # 正面边缘圆角
RB = 4.0             # 背面边缘圆角
JR = 16.0            # Joy-Con 外侧转角半径（正视）
GAP = 0.12           # 主机与 Joy-Con 之间的缝
SCREEN_W = 137.3     # 6.2" 16:9 可视区域
SCREEN_H = 77.2
STICK_PIVOT = 12.0   # 摇杆转动中心在正面之下的深度
STICK_R = 15.5       # 摇杆球面半径


def gl(v):
    """Blender 向量 → glTF 坐标（用于写进 extras 的方向）。"""
    return [round(v[0], 4), round(v[2], 4), round(-v[1], 4)]


# --------------------------------------------------------------------------
# 场景 & 材质
# --------------------------------------------------------------------------
def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.unit_settings.system = 'METRIC'
    sc.unit_settings.scale_length = 0.001
    sc.unit_settings.length_unit = 'MILLIMETERS'
    return sc


def srgb(h):
    h = h.lstrip('#')
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return [x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c]


MAT = {}


def material(name, hexcol, rough=0.5, metal=0.0, coat=0.0, coat_rough=0.05,
             emit=None, emit_strength=1.0, spec=0.5):
    m = bpy.data.materials.new(name)
    if m.node_tree is None:
        m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    col = srgb(hexcol)
    b.inputs['Base Color'].default_value = (*col, 1.0)
    b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metal
    b.inputs['Coat Weight'].default_value = coat
    b.inputs['Coat Roughness'].default_value = coat_rough
    b.inputs['Specular IOR Level'].default_value = spec
    if emit:
        b.inputs['Emission Color'].default_value = (*srgb(emit), 1.0)
        b.inputs['Emission Strength'].default_value = emit_strength
    m.diffuse_color = (*col, 1.0)
    m.roughness = rough
    m.metallic = metal
    MAT[name] = m
    return m


def add_grain(name, scale, strength, distance=0.02):
    """Cycles 渲染用的细微颗粒凹凸（glTF 不导出程序化节点，网页端另有法线贴图）。"""
    m = MAT[name]
    nt = m.node_tree
    bsdf = nt.nodes['Principled BSDF']
    tc = nt.nodes.new('ShaderNodeTexCoord')
    nz = nt.nodes.new('ShaderNodeTexNoise')
    nz.inputs['Scale'].default_value = scale
    nz.inputs['Detail'].default_value = 3.0
    bp = nt.nodes.new('ShaderNodeBump')
    bp.inputs['Strength'].default_value = strength
    bp.inputs['Distance'].default_value = distance
    nt.links.new(tc.outputs['Object'], nz.inputs['Vector'])
    nt.links.new(nz.outputs['Fac'], bp.inputs['Height'])
    nt.links.new(bp.outputs['Normal'], bsdf.inputs['Normal'])


def make_materials():
    material('JoyBlue', '#00b8e6', rough=0.46)
    material('JoyRed', '#ff4436', rough=0.46)
    material('Body', '#36373b', rough=0.58)
    material('BodyEdge', '#2e2f33', rough=0.5)
    material('Glass', '#050506', rough=0.04, coat=1.0, coat_rough=0.02, spec=0.6)
    material('Button', '#1b1b1e', rough=0.33, coat=0.2, coat_rough=0.2)
    material('ButtonGrey', '#2c2d31', rough=0.45)
    material('Print', '#d2d3d8', rough=0.55)
    material('PrintDim', '#7d7f86', rough=0.6)
    material('StickCap', '#2a2b2f', rough=0.72)
    material('StickDome', '#202124', rough=0.55)
    material('Gap', '#060607', rough=0.9)
    material('PortBlack', '#0b0b0c', rough=0.8)
    material('Plastic', '#121214', rough=0.5)
    material('RailMetal', '#8d9096', rough=0.32, metal=1.0)
    material('MetalDark', '#55585e', rough=0.42, metal=1.0)
    material('Gold', '#d9a84e', rough=0.28, metal=1.0)
    material('LED', '#1f3a26', rough=0.25, emit='#000000', emit_strength=0.0)
    material('HomeRing', '#3a3d44', rough=0.3, emit='#000000', emit_strength=0.0)
    material('IRWindow', '#070708', rough=0.05, coat=1.0, coat_rough=0.02)
    material('Card', '#e6e6e3', rough=0.5)
    material('CardLabel', '#ff8c2a', rough=0.5)
    material('Dock', '#1d1e21', rough=0.62)
    material('DockGloss', '#101012', rough=0.12, coat=0.6, coat_rough=0.08)
    material('Rubber', '#141416', rough=0.85)
    material('DockLED', '#18361f', rough=0.3, emit='#000000', emit_strength=0.0)

    for name, sc, st in (('JoyBlue', 1.6, 0.06), ('JoyRed', 1.6, 0.06), ('Body', 1.2, 0.08), ('Dock', 1.0, 0.1),
                         ('StickCap', 3.0, 0.12)):
        add_grain(name, sc, st)

    # 屏幕：底色纯黑 + 自发光贴图（网页查看器会换成实时画布）
    m = material('Screen', '#000000', rough=0.06, coat=1.0, coat_rough=0.02)
    nt = m.node_tree
    img = bpy.data.images.new('ScreenPlaceholder', 320, 180)
    px = []
    for y in range(180):
        for x in range(320):
            t = x / 319
            r, g, b_ = 0.08 + 0.85 * t, 0.10 + 0.25 * (y / 179), 0.35 * (1 - t)
            if x < 40 and y > 140:      # 左上角标记方块，用来检查 UV 方向
                r, g, b_ = 1.0, 0.55, 0.1
            px += [r, g, b_, 1.0]
    img.pixels = px
    img.pack()
    tex = nt.nodes.new('ShaderNodeTexImage')
    tex.image = img
    bsdf = nt.nodes['Principled BSDF']
    nt.links.new(tex.outputs['Color'], bsdf.inputs['Emission Color'])
    bsdf.inputs['Emission Strength'].default_value = 1.0


# --------------------------------------------------------------------------
# 2D 轮廓
# --------------------------------------------------------------------------
def dedupe(pts, eps=1e-7):
    out = []
    for p in pts:
        if not out or abs(p[0] - out[-1][0]) > eps or abs(p[1] - out[-1][1]) > eps:
            out.append(p)
    while len(out) > 1 and abs(out[0][0] - out[-1][0]) <= eps and abs(out[0][1] - out[-1][1]) <= eps:
        out.pop()
    return out


def rrect(x0, x1, y0, y1, radii=(0, 0, 0, 0), seg=8):
    """圆角矩形（逆时针）。radii = (左下, 右下, 右上, 左上)。"""
    bl, br, tr, tl = radii
    pts = []

    def arc(cx, cy, r, a0, a1):
        if r <= 1e-9:
            pts.append((cx, cy))
            return
        for i in range(seg + 1):
            a = radians(a0 + (a1 - a0) * i / seg)
            pts.append((cx + r * cos(a), cy + r * sin(a)))

    arc(x0 + bl, y0 + bl, bl, 180, 270)
    arc(x1 - br, y0 + br, br, 270, 360)
    arc(x1 - tr, y1 - tr, tr, 0, 90)
    arc(x0 + tl, y1 - tl, tl, 90, 180)
    return dedupe(pts)


def rrect_c(w, h, r, seg=8, cx=0.0, cy=0.0):
    """以 (cx, cy) 为中心、可内缩的圆角矩形轮廓函数。"""
    def f(d):
        rr = max(r - d, 0.0)
        return rrect(cx - w / 2 + d, cx + w / 2 - d, cy - h / 2 + d, cy + h / 2 - d, (rr,) * 4, seg)
    return f


def pill_c(w, h, seg=8):
    """胶囊形（横竖都可以），圆角半径 = 短边的一半。"""
    return rrect_c(w, h, min(w, h) / 2, seg)


def circle_c(r, n=32, cx=0.0, cy=0.0):
    def f(d):
        rr = r - d
        return [(cx + rr * cos(2 * pi * i / n), cy + rr * sin(2 * pi * i / n)) for i in range(n)]
    return f


def cross_c(L, a, r=0.35, seg=4):
    """十字形（+ 键）。L = 臂总长，a = 臂宽，r = 外角圆角。"""
    def f(d):
        h = L / 2 - d
        w = a / 2 - d
        rr = max(r - d, 0.0)
        pts = []

        def arc(cx, cy, a0, a1):
            if rr <= 1e-9:
                pts.append((cx, cy))
                return
            for i in range(seg + 1):
                t = radians(a0 + (a1 - a0) * i / seg)
                pts.append((cx + rr * cos(t), cy + rr * sin(t)))
        # 从右臂开始逆时针
        arc(h - rr, -w + rr, 270, 360)
        arc(h - rr, w - rr, 0, 90)
        pts.append((w, w))
        arc(w - rr, h - rr, 0, 90)
        arc(-w + rr, h - rr, 90, 180)
        pts.append((-w, w))
        arc(-h + rr, w - rr, 90, 180)
        arc(-h + rr, -w + rr, 180, 270)
        pts.append((-w, -w))
        arc(-w + rr, -h + rr, 180, 270)
        arc(w - rr, -h + rr, 270, 360)
        pts.append((w, -w))
        return dedupe(pts)
    return f


def poly_c(pts):
    return lambda d: pts


# --------------------------------------------------------------------------
# bmesh 构建工具
# --------------------------------------------------------------------------
def loft(profile, levels, sharp_caps=True):
    """按 levels = [(w, d), ...] 把轮廓放样成封闭实体：在高度 w 处取内缩 d 的轮廓（d 为负则外扩）。"""
    lv = []
    for L in levels:
        if not lv or abs(L[0] - lv[-1][0]) > 1e-7 or abs(L[1] - lv[-1][1]) > 1e-7:
            lv.append(L)
    bm = bmesh.new()
    loops = []
    for (w, d) in lv:
        pts = profile(d)
        loops.append([bm.verts.new((u, v, w)) for (u, v) in pts])
    n = len(loops[0])
    assert all(len(l) == n for l in loops), 'profile vertex count must not change with inset'
    for k in range(len(loops) - 1):
        A, B = loops[k], loops[k + 1]
        for i in range(n):
            j = (i + 1) % n
            bm.faces.new((A[i], A[j], B[j], B[i]))
    f0 = bm.faces.new(loops[0])
    f1 = bm.faces.new(loops[-1][::-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    for f in bm.faces:
        f.smooth = True
    if sharp_caps:
        for f in (f0, f1):
            for e in f.edges:
                e.smooth = False
    return bm


def rslab(profile, w0, w1, r0=0.0, r1=0.0, n0=4, n1=4, sharp_caps=True):
    """沿局部 W 轴把轮廓挤出成实体，两端可做圆角。
    profile(d) 返回内缩 d 后的 (u, v) 逆时针轮廓。"""
    levels = []
    if r0 > 0:
        for i in range(n0 + 1):
            p = (pi / 2) * i / n0
            levels.append((w0 + r0 * (1 - cos(p)), r0 * (1 - sin(p))))
    else:
        levels.append((w0, 0.0))
    if r1 > 0:
        for i in range(n1, -1, -1):
            p = (pi / 2) * i / n1
            levels.append((w1 - r1 * (1 - cos(p)), r1 * (1 - sin(p))))
    else:
        levels.append((w1, 0.0))
    return loft(profile, levels, sharp_caps)


def flared(profile, depth, fillet, top=1.5, n=4):
    """开孔用的切割体：深处按轮廓原样，靠近表面时按四分之一圆向外张开 fillet，
    切出来的孔口就带一圈圆角（真实塑料件的孔边都不是锐边，高光会更自然）。"""
    levels = [(-depth, 0.0)]
    for i in range(n + 1):
        a = (pi / 2) * i / n
        levels.append((-fillet + fillet * sin(a), -fillet * (1 - cos(a))))
    levels.append((top, -fillet))
    return loft(profile, levels)


def lathe(profile, steps=48, closed=False):
    """绕局部 W 轴旋转 (r, w) 轮廓。首尾点在轴上（r=0）或 closed=True（环形截面）时得到封闭体。"""
    bm = bmesh.new()
    rings = []
    for (r, w) in profile:
        if r < 1e-6:
            rings.append([bm.verts.new((0.0, 0.0, w))])
        else:
            rings.append([bm.verts.new((r * cos(2 * pi * i / steps), r * sin(2 * pi * i / steps), w))
                          for i in range(steps)])
    pairs = list(range(len(rings) - 1))
    if closed:
        pairs.append(-1)
    for k in pairs:
        A, B = rings[k], rings[k + 1]
        if len(A) == 1 and len(B) == 1:
            continue
        for i in range(steps):
            j = (i + 1) % steps
            if len(A) == 1:
                bm.faces.new((A[0], B[i], B[j]))
            elif len(B) == 1:
                bm.faces.new((A[i], A[j], B[0]))
            else:
                bm.faces.new((A[i], A[j], B[j], B[i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    for f in bm.faces:
        f.smooth = True
    return bm


def box_bm(x0, x1, y0, y1, z0, z1):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co.x = x0 if v.co.x < 0 else x1
        v.co.y = y0 if v.co.y < 0 else y1
        v.co.z = z0 if v.co.z < 0 else z1
    return bm


def cyl_bm(r, w0, w1, n=32):
    return rslab(circle_c(r, n), w0, w1)


# 局部 (u, v, w) → 世界坐标；w 为离开表面的方向
FRAMES = {
    'front': Matrix(((1, 0, 0), (0, 0, -1), (0, 1, 0))),
    'back': Matrix(((-1, 0, 0), (0, 0, 1), (0, 1, 0))),
    'top': Matrix(((1, 0, 0), (0, 1, 0), (0, 0, 1))),
    'bottom': Matrix(((1, 0, 0), (0, -1, 0), (0, 0, -1))),
    'right': Matrix(((0, 0, 1), (1, 0, 0), (0, 1, 0))),
    'left': Matrix(((0, 0, -1), (-1, 0, 0), (0, 1, 0))),
    'shell': Matrix(((1, 0, 0), (0, 0, 1), (0, 1, 0))),   # (u, v, w) → (x=u, y=w, z=v)
}


def place(bm, frame, origin=(0, 0, 0), rot_w=0.0):
    M3 = FRAMES[frame]
    M = Matrix.Translation(Vector(origin)) @ M3.to_4x4()
    if rot_w:
        M = M @ Matrix.Rotation(radians(rot_w), 4, 'Z')
    bmesh.ops.transform(bm, matrix=M, verts=bm.verts[:])
    if M3.determinant() < 0:
        bmesh.ops.reverse_faces(bm, faces=bm.faces[:])
    return bm


def merge(dst, src, mat_index=0):
    vmap = {v: dst.verts.new(v.co) for v in src.verts}
    for f in src.faces:
        nf = dst.faces.new([vmap[v] for v in f.verts])
        nf.material_index = mat_index
        nf.smooth = f.smooth
    for e in src.edges:
        if not e.smooth:
            ne = dst.edges.get([vmap[e.verts[0]], vmap[e.verts[1]]])
            if ne:
                ne.smooth = False
    src.free()
    return dst


def combine(*parts):
    """parts: (bm, mat_index) 列表 → 新 bmesh。"""
    out = bmesh.new()
    for bm, mi in parts:
        merge(out, bm, mi)
    return out


COLL = None


def new_obj(name, bm, mats, loc=None, parent=None, **props):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    for m in mats:
        me.materials.append(MAT[m])
    ob = bpy.data.objects.new(name, me)
    COLL.objects.link(ob)
    if loc is not None:
        ob.location = loc
    for k, v in props.items():
        ob[k] = v
    if parent is not None:
        set_parent(ob, parent)
    return ob


def empty(name, loc=(0, 0, 0), parent=None, **props):
    ob = bpy.data.objects.new(name, None)
    ob.empty_display_type = 'PLAIN_AXES'
    ob.empty_display_size = 4
    ob.location = loc
    COLL.objects.link(ob)
    for k, v in props.items():
        ob[k] = v
    if parent is not None:
        set_parent(ob, parent)
    return ob


def world_loc(ob):
    p = Vector((0, 0, 0))
    while ob is not None:
        p += ob.location
        ob = ob.parent
    return p


def set_parent(child, par):
    """父级都是无旋转的空物体：保持世界位置不变地挂到父级下。"""
    w = world_loc(child)
    child.parent = par
    child.location = w - world_loc(par)


def apply_modifiers(ob):
    dg = bpy.context.evaluated_depsgraph_get()
    dg.update()
    ev = ob.evaluated_get(dg)
    me = bpy.data.meshes.new_from_object(ev, preserve_all_data_layers=True, depsgraph=dg)
    old = ob.data
    ob.modifiers.clear()
    ob.data = me
    me.name = old.name
    bpy.data.meshes.remove(old)


def cutter(bm, mat='Gap'):
    me = bpy.data.meshes.new('cutter')
    bm.to_mesh(me)
    bm.free()
    me.materials.append(MAT[mat])
    ob = bpy.data.objects.new('cutter', me)
    return ob


def nonmanifold(me):
    bm = bmesh.new()
    bm.from_mesh(me)
    n = sum(1 for e in bm.edges if len(e.link_faces) != 2)
    bm.free()
    return n


def _apply_cut(target, cutters, solver):
    coll = bpy.data.collections.new('cut_' + target.name)
    bpy.context.scene.collection.children.link(coll)
    for c in cutters:
        coll.objects.link(c)
    mod = target.modifiers.new('cut', 'BOOLEAN')
    mod.operation = 'DIFFERENCE'
    mod.operand_type = 'COLLECTION'
    mod.collection = coll
    mod.solver = solver
    if solver == 'EXACT':
        mod.material_mode = 'TRANSFER'
    apply_modifiers(target)
    for c in cutters:
        coll.objects.unlink(c)
    bpy.data.collections.remove(coll)


def boolean_cut(target, cutters, solver='EXACT', batch=6):
    """布尔减去一组切割体。一次减太多个时 EXACT 求解器偶尔会留下非流形的缝，
    所以分小批进行；某一批出问题就退回去逐个切。"""
    if not cutters:
        return
    for i in range(0, len(cutters), batch):
        group = cutters[i:i + batch]
        before = nonmanifold(target.data)
        backup = target.data.copy()
        _apply_cut(target, group, solver)
        if len(group) > 1 and nonmanifold(target.data) > before:
            broken = target.data
            target.data = backup
            bpy.data.meshes.remove(broken)
            for c in group:
                _apply_cut(target, [c], solver)
        else:
            bpy.data.meshes.remove(backup)
    target.data.validate(verbose=False)
    for c in cutters:
        me = c.data
        bpy.data.objects.remove(c, do_unlink=True)
        bpy.data.meshes.remove(me)


def smooth_by_angle(ob, angle=33):
    """保留已有硬边，同时把夹角大于阈值的边设为硬边。"""
    me = ob.data
    bm = bmesh.new()
    bm.from_mesh(me)
    th = radians(angle)

    def axial(n):
        return max(abs(n.x), abs(n.y), abs(n.z)) > 0.99999

    for f in bm.faces:
        f.smooth = True
    for e in bm.edges:
        if len(e.link_faces) != 2:
            e.smooth = False
            continue
        f0, f1 = e.link_faces
        if e.calc_face_angle(pi) >= th or (axial(f0.normal) != axial(f1.normal)):
            e.smooth = False
    bm.to_mesh(me)
    bm.free()


def box_uv(ob, scale=10.0):
    """盒投影 UV：按面的朝向投到 XY / XZ / YZ 平面，1 个 UV 单位 = scale 毫米。
    网页端的表面纹理（塑料颗粒、金属拉丝）靠它贴图。"""
    me = ob.data
    bm = bmesh.new()
    bm.from_mesh(me)
    uv = bm.loops.layers.uv.verify()
    off = world_loc(ob)
    for f in bm.faces:
        n = f.normal
        ax = max(range(3), key=lambda i: abs(n[i]))
        for lp in f.loops:
            p = lp.vert.co + off
            if ax == 0:
                u, v = p.y, p.z
            elif ax == 1:
                u, v = p.x, p.z
            else:
                u, v = p.x, p.y
            lp[uv].uv = (u / scale, v / scale)
    bm.to_mesh(me)
    bm.free()


def text_bm(txt, size, depth, bold=0.0):
    """文字 → bmesh（局部 XY 平面居中，Z 从 0 到 depth）。"""
    cu = bpy.data.curves.new('tmp_text', 'FONT')
    cu.body = txt
    cu.size = size
    cu.extrude = depth / 2
    cu.offset = bold
    cu.align_x = 'CENTER'
    cu.align_y = 'CENTER'
    cu.resolution_u = 3
    ob = bpy.data.objects.new('tmp_text', cu)
    COLL.objects.link(ob)
    dg = bpy.context.evaluated_depsgraph_get()
    dg.update()
    me = bpy.data.meshes.new_from_object(ob.evaluated_get(dg))
    bm = bmesh.new()
    bm.from_mesh(me)
    bpy.data.objects.remove(ob, do_unlink=True)
    bpy.data.curves.remove(cu)
    bpy.data.meshes.remove(me)
    xs = [v.co.x for v in bm.verts]
    ys = [v.co.y for v in bm.verts]
    zs = [v.co.z for v in bm.verts]
    cx, cy, z0 = (min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2, min(zs)
    for v in bm.verts:
        v.co.x -= cx
        v.co.y -= cy
        v.co.z -= z0
    bmesh.ops.remove_doubles(bm, verts=bm.verts[:], dist=1e-5)
    for f in bm.faces:
        f.smooth = False
    return bm


def conform(bm, surface, sink=0.05):
    """把贴在按键顶面的图标/文字顶点贴合到曲面 w = surface(r)。"""
    zs = [v.co.z for v in bm.verts]
    z0, z1 = min(zs), max(zs)
    for v in bm.verts:
        r = sqrt(v.co.x ** 2 + v.co.y ** 2)
        t = (v.co.z - z0) / (z1 - z0) if z1 > z0 else 1
        v.co.z = surface(r) - sink + t * (z1 - z0)
    return bm


def flat_poly_bm(pts, h0, h1):
    return rslab(poly_c(pts), h0, h1)


# --------------------------------------------------------------------------
# 通用按键形状
# --------------------------------------------------------------------------
def round_button(r, top, base, fillet=0.55, dome=0.15, seg=72):
    """圆形按键（局部 W 向外），顶面略微隆起。返回 (bmesh, 顶面函数)。"""
    rf = r - fillet

    def surf(rr):
        rr = min(rr, rf)
        return top + dome * (1 - (rr / rf) ** 2)

    prof = [(0.0, top + dome)]
    for i in range(1, 9):
        rr = rf * i / 8
        prof.append((rr, surf(rr)))
    for i in range(1, 9):
        a = (pi / 2) * (1 - i / 8)
        prof.append((rf + fillet * cos(a), top - fillet + fillet * sin(a)))
    prof.append((r, base))
    prof.append((0.0, base))
    return lathe(prof, seg), surf


def icon_on(bm_icon, surf, sink=0.04):
    return conform(bm_icon, surf, sink)


def tri_pts(size, direction):
    """十字键上的小三角形箭头。direction：'UP' 'DOWN' 'LEFT' 'RIGHT'。"""
    h = size * 0.8
    pts = [(0, h * 0.62), (-size / 2, -h * 0.38), (size / 2, -h * 0.38)]
    ang = {'UP': 0, 'LEFT': 90, 'DOWN': 180, 'RIGHT': 270}[direction]
    c, s = cos(radians(ang)), sin(radians(ang))
    return [(x * c - y * s, x * s + y * c) for x, y in pts]


def house_pts(s):
    """HOME 键上的小房子。"""
    return [(-0.42 * s, -0.45 * s), (0.42 * s, -0.45 * s), (0.42 * s, 0.05 * s),
            (0.62 * s, 0.05 * s), (0.0, 0.55 * s), (-0.62 * s, 0.05 * s), (-0.42 * s, 0.05 * s)]


def power_icon_bm(size, depth):
    """电源符号：开口圆环 + 竖线。"""
    ro, ri = size / 2, size / 2 - size * 0.16
    a0, a1 = radians(125), radians(415)
    n = 18
    pts = [(ro * cos(a0 + (a1 - a0) * i / n), ro * sin(a0 + (a1 - a0) * i / n)) for i in range(n + 1)]
    pts += [(ri * cos(a0 + (a1 - a0) * i / n), ri * sin(a0 + (a1 - a0) * i / n)) for i in range(n, -1, -1)]
    bm = flat_poly_bm(pts, 0, depth)
    bar = rslab(rrect_c(size * 0.16, size * 0.62, 0.0, 2, 0, size * 0.22), 0, depth)
    return combine((bm, 0), (bar, 0))


# --------------------------------------------------------------------------
# 主机
# --------------------------------------------------------------------------
def build_console(root):
    con = empty('Console', parent=root)

    # ---- 机身 ----
    prof = lambda d: rrect(-XC, XC, -ZT + d, ZT - d)
    bm = rslab(prof, YF + 0.45, YB, RF, RB, 7, 12)
    place(bm, 'shell')
    body = new_obj('Console_Body', bm, ['Body'])

    cuts = []
    yc = -1.2   # 顶面/底面平坦区域中线

    # 顶部：电源键、音量键凹槽
    tops = [('POWER', -66.0, 6.8), ('VOL_DOWN', -55.0, 5.6), ('VOL_UP', -47.4, 5.6)]
    for _, x, w in tops:
        c = flared(pill_c(w + 0.5, 3.0, 10), 1.6, 0.28)
        place(c, 'top', (x, yc, ZT))
        cuts.append(cutter(c, 'Gap'))

    # 顶部出风口：一排细槽，槽与槽之间的隔片就是机身本身
    x = -29.6
    while x < 21.6:
        c = box_bm(x, x + 1.1, -2.5, 0.1, ZT - 3.4, ZT + 1)
        cuts.append(cutter(c, 'PortBlack'))
        x += 1.45
    # 3.5mm 耳机孔
    c = flared(circle_c(1.95, 40), 8.0, 0.35)
    place(c, 'top', (33.0, yc, ZT))
    cuts.append(cutter(c, 'PortBlack'))
    # 游戏卡槽：盖板凹位 + 卡槽开口
    c = rslab(rrect_c(28.3, 6.9, 0.9), -0.8, 1.0)
    place(c, 'top', (56.0, -1.45, ZT))
    cuts.append(cutter(c, 'Gap'))
    c = box_bm(44.5, 67.5, -3.3, 0.5, ZT - 10, ZT - 0.5)
    cuts.append(cutter(c, 'PortBlack'))

    # 底部 USB-C
    c = flared(pill_c(8.9, 3.2, 12), 6.0, 0.35)
    place(c, 'bottom', (0.0, yc, -ZT))
    cuts.append(cutter(c, 'MetalDark'))

    # 背面：支架凹位、microSD、扬声器孔、进风口
    c = box_bm(-62.3, -19.7, YB - 1.6, YB + 1, -46.9, -19.0)
    cuts.append(cutter(c, 'Gap'))
    c = box_bm(-47.5, -35.5, YB - 4.5, YB - 1.5, -31.2, -29.6)
    cuts.append(cutter(c, 'PortBlack'))
    for sx in (-1, 1):
        for row in range(4):
            for col in range(8):
                x = sx * 74.5 + (col - 3.5) * 1.55
                z = -41.5 + (row - 1.5) * 1.55 + (0.775 if col % 2 else 0)
                c = cyl_bm(0.42, -1.4, 1.0, 10)
                place(c, 'back', (x, YB, z))
                cuts.append(cutter(c, 'PortBlack'))
    for i in range(48):
        x = -54.0 + i * 2.3
        c = rslab(pill_c(0.9, 5.2, 4), -1.3, 1.0)
        place(c, 'back', (x, YB, 41.0))
        cuts.append(cutter(c, 'PortBlack'))

    # 两侧滑轨槽（金属内壁）
    for sx in (-1, 1):
        x0, x1 = sorted((sx * (XC + 0.2), sx * (XC - 3.6)))
        c = box_bm(x0, x1, -2.85, 2.85, -48.0, ZT + 2)
        cuts.append(cutter(c, 'RailMetal'))

    boolean_cut(body, cuts)
    smooth_by_angle(body)
    set_parent(body, con)
    body['info'] = '主机机身（初代 Switch 尺寸 173 × 102 × 13.9 mm）'

    # ---- 正面玻璃 + 屏幕 ----
    build_glass(con)

    # ---- 顶部按键 ----
    names = {'POWER': '电源键', 'VOL_DOWN': '音量 −', 'VOL_UP': '音量 +'}
    for key, x, w in tops:
        bm = rslab(pill_c(w, 2.5), -1.2, 0.55, 0.0, 0.35, 1, 3)
        place(bm, 'top', (x, yc, ZT))
        ob = new_obj('Btn_' + key, bm, ['ButtonGrey'], parent=con)
        smooth_by_angle(ob)
        ob['btn'] = key
        ob['label'] = names[key]
        ob['press'] = gl((0, 0, -0.45))
    # 印在顶面的小图标（电源 / − / +）
    icons = bmesh.new()
    pi_bm = power_icon_bm(1.7, 0.03)
    place(pi_bm, 'top', (-66.0, 2.05, ZT))
    merge(icons, pi_bm)
    m_bm = rslab(rrect_c(1.3, 0.28, 0.1, 2), 0, 0.03)
    place(m_bm, 'top', (-55.0, 2.05, ZT))
    merge(icons, m_bm)
    p_bm = rslab(cross_c(1.3, 0.28, 0.1, 2), 0, 0.03)
    place(p_bm, 'top', (-47.4, 2.05, ZT))
    merge(icons, p_bm)
    new_obj('Console_TopPrint', icons, ['PrintDim'], parent=con)


    # 耳机孔内圈
    ring = lathe([(0, -2.8), (1.9, -2.8), (1.9, -0.08), (1.6, -0.08), (1.6, -2.6), (0, -2.6)], 28)
    place(ring, 'top', (33.0, yc, ZT))
    new_obj('Console_Jack', ring, ['Plastic'], parent=con, info='3.5mm 耳机孔')

    # 游戏卡槽盖（铰链在后侧）
    hinge = Vector((56.0, 1.95, ZT - 0.4))
    cover_piv = empty('GameCardCover', loc=hinge, parent=con,
                      toggle='cardcover', label='游戏卡槽盖（点击开合）',
                      openAxis=gl((1, 0, 0)), openAngle=-105.0)
    bm = rslab(rrect_c(28.0, 6.6, 0.8), -0.8, 0.0, 0.0, 0.25, 1, 2)
    place(bm, 'top', (56.0, -1.45, ZT))
    cov = new_obj('GameCardCover_Mesh', bm, ['Body'])
    notch = cyl_bm(1.3, -2, 2, 20)
    place(notch, 'top', (56.0, -4.75, ZT))
    boolean_cut(cov, [cutter(notch, 'BodyEdge')])
    smooth_by_angle(cov)
    for v in cov.data.vertices:
        v.co -= hinge
    cov.location = hinge
    set_parent(cov, cover_piv)
    cov['toggle'] = 'cardcover'
    cov['label'] = '游戏卡槽盖（点击开合）'

    # 插在卡槽里的游戏卡（打开盖子可以看到）
    card = combine((box_bm(45.0, 67.0, -2.9, 0.1, ZT - 33, ZT - 1.6), 0),
                   (box_bm(46.0, 66.0, -2.95, 0.15, ZT - 6, ZT - 1.55), 1))
    new_obj('Console_GameCard', card, ['Card', 'CardLabel'], parent=con, info='游戏卡（原创《橙子冒险》）')

    # USB-C 舌片
    tongue = combine(
        (box_bm(-3.3, 3.3, yc - 0.35, yc + 0.35, -ZT + 1.1, -ZT + 5.0), 0),
        (box_bm(-2.9, 2.9, yc - 0.37, yc + 0.37, -ZT + 1.3, -ZT + 3.6), 1))
    new_obj('Console_USBC', tongue, ['Plastic', 'Gold'], parent=con, info='USB Type-C 接口（充电 / 连接底座）')

    # ---- 背面：支架 ----
    hinge = Vector((-41.0, YB - 0.75, -19.3))
    ks_piv = empty('Kickstand', loc=hinge, parent=con, toggle='kickstand',
                   label='支架（点击开合）', openAxis=gl((1, 0, 0)), openAngle=62.0)
    prof = lambda d: rrect(-62.0 + d, -20.0 - d, -46.6 + d, -19.3 - d, (max(1.2 - d, 0),) * 4, 6)
    bm = rslab(prof, YB - 1.5, YB, 0.0, 0.45, 1, 3)
    place(bm, 'shell')
    # 支架内侧的防滑纹
    for i in range(6):
        g = box_bm(-58.0, -24.0, YB - 1.57, YB - 1.45, -44.0 + i * 1.2, -43.6 + i * 1.2)
        merge(bm, g, 0)
    ks = new_obj('Kickstand_Mesh', bm, ['Body'])
    smooth_by_angle(ks)
    for v in ks.data.vertices:
        v.co -= hinge
    ks.location = hinge
    set_parent(ks, ks_piv)
    ks['toggle'] = 'kickstand'
    ks['label'] = '支架（点击开合，下面藏着 microSD 卡槽）'

    sd = text_bm('microSD', 1.5, 0.03)
    place(sd, 'back', (-41.5, YB - 1.6, -34.2))
    new_obj('Console_SDPrint', sd, ['PrintDim'], parent=con, info='microSD 卡槽')

    # 背面螺丝
    screws = bmesh.new()
    for sx in (-1, 1):
        for sz in (-1, 1):
            s = lathe([(0, 0.18), (0.7, 0.17), (1.05, 0.08), (1.1, -0.2), (0, -0.2)], 20)
            for (cx0, cx1, cy0, cy1) in ((-0.6, 0.6, -0.09, 0.09), (-0.09, 0.09, -0.6, 0.6)):
                g = box_bm(cx0, cx1, cy0, cy1, 0.1, 0.2)
                merge(s, g, 1)
            place(s, 'back', (sx * 83.4, YB, sz * 46.3))
            merge(screws, s, 0)
    new_obj('Console_Screws', screws, ['MetalDark', 'Gap'], parent=con, info='背壳螺丝')

    # 滑轨槽底部的连接器针脚
    pins = bmesh.new()
    for sx in (-1, 1):
        xf = sx * (XC - 3.6)            # 滑槽底面，触点朝外（朝向 Joy-Con）凸出
        for i in range(10):
            z = -47.0 + i * 0.33
            a, b = sorted((xf - sx * 0.05, xf + sx * 0.25))
            merge(pins, box_bm(a, b, -1.1, 1.1, z - 0.085, z + 0.085), 1)
        a, b = sorted((xf - sx * 0.05, xf + sx * 0.1))
        merge(pins, box_bm(a, b, -1.6, 1.6, -47.7, -43.3), 0)
    new_obj('Console_RailPins', pins, ['Plastic', 'Gold'], parent=con, info='Joy-Con 滑轨触点')

    return con


def build_glass(con):
    gx0, gx1 = -XC + 0.3, XC - 0.3
    gz0, gz1 = -ZT + 0.85, ZT - 0.85
    yf, yb = YF, YF + 0.55
    r = 0.3
    prof = lambda d: rrect(gx0 + d, gx1 - d, gz0 + d, gz1 - d)
    bm = rslab(prof, yf, yb, r, 0.0, 3, 1)       # 局部 (u=x, v=z, w=y)
    # 找到正面那块面（w == yf）并换成 “边框环 + 屏幕” 两部分
    front = [f for f in bm.faces if all(abs(v.co.z - yf) < 1e-6 for v in f.verts)][0]
    outer = [v for v in front.verts]
    bmesh.ops.delete(bm, geom=[front], context='FACES_ONLY')
    # outer 顶点按 rrect 顺序：左下、右下、右上、左上
    outer.sort(key=lambda v: (round(math.atan2(v.co.y, v.co.x), 6)))
    ol = {('l' if v.co.x < 0 else 'r') + ('b' if v.co.y < 0 else 't'): v for v in outer}
    sx0, sx1 = -SCREEN_W / 2, SCREEN_W / 2
    sz0, sz1 = -SCREEN_H / 2, SCREEN_H / 2
    il = {'lb': bm.verts.new((sx0, sz0, yf)), 'rb': bm.verts.new((sx1, sz0, yf)),
          'rt': bm.verts.new((sx1, sz1, yf)), 'lt': bm.verts.new((sx0, sz1, yf))}
    order = ['lb', 'rb', 'rt', 'lt']
    for i in range(4):
        a, b = order[i], order[(i + 1) % 4]
        f = bm.faces.new((ol[a], ol[b], il[b], il[a]))
        f.material_index = 0
    scr = bm.faces.new([il[k] for k in order])
    scr.material_index = 1
    uv = bm.loops.layers.uv.verify()
    uvmap = {'lb': (0.0, 0.0), 'rb': (1.0, 0.0), 'rt': (1.0, 1.0), 'lt': (0.0, 1.0)}
    for loop in scr.loops:
        for k, v in il.items():
            if loop.vert == v:
                loop[uv].uv = uvmap[k]
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    for f in bm.faces:
        f.smooth = False
    place(bm, 'shell')
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    ob = new_obj('Console_Glass', bm, ['Glass', 'Screen'], parent=con)
    ob['info'] = '6.2 英寸电容触摸屏 · 1280×720'
    return ob


# --------------------------------------------------------------------------
# Joy-Con
# --------------------------------------------------------------------------
def band_profile(sgn, x_start, a_end, r_out, r_in, seg=22):
    """顶边 + 外侧转角的带状轮廓（肩键/扳机用），可内缩。
    sgn = -1 左 / +1 右；x_start 为带子内侧端点到中心的距离（绝对值）；
    a_end 为绕外侧转角走到的角度（90° = 顶边，180° = 外侧竖边）。"""
    cxa = XJ - JR
    cz = ZT - JR

    def f(d):
        ro, ri = r_out - d, r_in + d
        ae = radians(a_end) - d / ((ro + ri) / 2)
        # 先按左手柄（x 为负）生成，右手柄镜像
        pts = [(-x_start - d, cz + ro)]
        for i in range(seg + 1):
            a = radians(90) + (ae - radians(90)) * i / seg
            pts.append((-cxa + ro * cos(a), cz + ro * sin(a)))
        for i in range(seg, -1, -1):
            a = radians(90) + (ae - radians(90)) * i / seg
            pts.append((-cxa + ri * cos(a), cz + ri * sin(a)))
        pts.append((-x_start - d, cz + ri))
        if sgn > 0:
            pts = [(-x, z) for (x, z) in pts][::-1]
        return dedupe(pts)
    return f


def build_joycon(root, side):
    s = -1 if side == 'L' else 1
    col = 'JoyBlue' if side == 'L' else 'JoyRed'
    jc = empty('JoyCon_' + side, loc=(s * XC, 0, 0), parent=root,
               joycon=side, label=f'Joy-Con（{side}）')
    x_in = s * (XC + GAP)
    x_out = s * XJ

    # ---- 外壳 ----
    if side == 'L':
        prof = lambda d: rrect(x_out + d, x_in, -ZT + d, ZT - d, (JR - d, 0, 0, JR - d), 36)
    else:
        prof = lambda d: rrect(x_in, x_out - d, -ZT + d, ZT - d, (0, JR - d, JR - d, 0), 36)
    bm = rslab(prof, YF, YB, RF, RB, 7, 12)
    place(bm, 'shell')
    shell = new_obj(f'JoyCon_{side}_Shell', bm, [col])

    xc = s * (XC + JW / 2)     # 中线 ±103
    xi = s * (XC + 6.3)        # 内侧列 ±92.8
    z_up, z_lo = 22.0, -13.5
    cuts = []

    def pocket(profile_fn, x, z, depth=2.0, mat='Gap'):
        c = flared(profile_fn, depth, 0.3)
        place(c, 'front', (x, YF, z))
        cuts.append(cutter(c, mat))

    # 摇杆孔
    stick_x, stick_z = (xc, z_up) if side == 'L' else (xc, z_lo)
    c = flared(circle_c(10.2, 96), 5.0, 0.7)
    place(c, 'front', (stick_x, YF, stick_z))
    cuts.append(cutter(c, 'Gap'))

    # 四个圆形按键（L：方向键；R：ABXY）
    dia_z = z_lo if side == 'L' else z_up
    off = 8.3
    if side == 'L':
        quad = [('UP', 0, off), ('DOWN', 0, -off), ('LEFT', -off, 0), ('RIGHT', off, 0)]
    else:
        quad = [('X', 0, off), ('B', 0, -off), ('Y', -off, 0), ('A', off, 0)]
    for _, dx, dz in quad:
        pocket(circle_c(3.98, 64), xc + dx, dia_z + dz)

    # − / + 、截图 / HOME
    if side == 'L':
        pocket(pill_c(6.3, 2.6), xi, 43.6)
        pocket(rrect_c(6.2, 6.2, 1.5), xi, -36.5)
    else:
        pocket(cross_c(6.6, 2.6, 0.5), xi, 43.6)
        pocket(circle_c(4.45, 64), xi, -36.5)

    # 肩键 L/R 与扳机 ZL/ZR 的凹位
    Lc = rslab(band_profile(s, XC + 2.9, 152, JR + 3.0, JR - 3.05), -6.3, -0.6)
    place(Lc, 'shell')
    cuts.append(cutter(Lc, 'Gap'))
    Zc = rslab(band_profile(s, XC + 4.6, 171, JR + 3.0, 8.75), 0.1, YB + 1.0)
    place(Zc, 'shell')
    cuts.append(cutter(Zc, 'Gap'))

    # 背面解锁按钮孔
    c = flared(circle_c(2.45, 40), 1.5, 0.25)
    place(c, 'back', (s * (XC + 4.2), YB, 38.0))
    cuts.append(cutter(c, 'Gap'))

    # 右手柄底部的红外摄像头窗口
    if side == 'R':
        c = rslab(rrect_c(9.0, 5.4, 1.4), -0.35, 1.0)
        place(c, 'bottom', (95.6, -0.8, -ZT))
        cuts.append(cutter(c, 'Gap'))

    boolean_cut(shell, cuts)
    smooth_by_angle(shell)
    set_parent(shell, jc)
    shell['info'] = f'Joy-Con（{side}）外壳 · {"电光蓝" if side == "L" else "电光红"}'

    # ---- 圆形按键 ----
    labels = {'UP': '方向键 ↑', 'DOWN': '方向键 ↓', 'LEFT': '方向键 ←', 'RIGHT': '方向键 →',
              'A': 'A 键', 'B': 'B 键', 'X': 'X 键', 'Y': 'Y 键'}
    for key, dx, dz in quad:
        bm, surf = round_button(3.7, 1.55, -1.75, 0.55, 0.16)
        if side == 'L':
            icon = flat_poly_bm(tri_pts(2.0, key), 0, 0.12)
        else:
            icon = text_bm(key, 3.0, 0.12, bold=0.012)
        icon_on(icon, surf)
        bm = combine((bm, 0), (icon, 1))
        place(bm, 'front', (xc + dx, YF, dia_z + dz))
        ob = new_obj('Btn_' + key, bm, ['Button', 'Print'], parent=jc)
        ob['btn'] = key
        ob['label'] = labels[key]
        ob['press'] = gl((0, 0.85, 0))

    # − / +
    if side == 'L':
        bm = rslab(pill_c(5.6, 1.9), -1.4, 1.05, 0.0, 0.45, 1, 3)
        place(bm, 'front', (xi, YF, 43.6))
        ob = new_obj('Btn_MINUS', bm, ['Button'], parent=jc, btn='MINUS', label='− 键')
    else:
        bm = rslab(cross_c(5.9, 1.9, 0.55), -1.4, 1.05, 0.0, 0.42, 1, 3)
        place(bm, 'front', (xi, YF, 43.6))
        ob = new_obj('Btn_PLUS', bm, ['Button'], parent=jc, btn='PLUS', label='+ 键')
    smooth_by_angle(ob)
    ob['press'] = gl((0, 0.75, 0))

    # 截图键 / HOME 键
    if side == 'L':
        bm = rslab(rrect_c(5.6, 5.6, 1.2), -1.4, 0.95, 0.0, 0.4, 1, 3)
        place(bm, 'front', (xi, YF, -36.5))
        ob = new_obj('Btn_CAPTURE', bm, ['Button'], parent=jc, btn='CAPTURE', label='截图键')
        dimple = lathe([(0, 1.5), (1.75, 1.5), (1.75, 0.72), (0, 0.72)], 32)
        place(dimple, 'front', (xi, YF, -36.5))
        boolean_cut(ob, [cutter(dimple, 'ButtonGrey')])
        smooth_by_angle(ob)
        ob['press'] = gl((0, 0.7, 0))
    else:
        bm, surf = round_button(3.4, 0.95, -1.4, 0.45, 0.08)
        icon = flat_poly_bm(house_pts(2.3), 0, 0.1)
        icon_on(icon, surf)
        bm = combine((bm, 0), (icon, 1))
        place(bm, 'front', (xi, YF, -36.5))
        ob = new_obj('Btn_HOME', bm, ['ButtonGrey', 'Print'], parent=jc, btn='HOME', label='HOME 键')
        ob['press'] = gl((0, 0.7, 0))
        ring = lathe([(3.62, 0.04), (4.3, 0.04), (4.3, -1.0), (3.62, -1.0)], 72, closed=True)
        place(ring, 'front', (xi, YF, -36.5))
        new_obj('HomeRing', ring, ['HomeRing'], parent=jc, info='HOME 键指示灯环')

    # ---- 摇杆 ----
    build_stick(jc, side, stick_x, stick_z)

    # ---- 肩键 L/R ----
    key = 'L' if side == 'L' else 'R'
    bm = rslab(band_profile(s, XC + 3.2, 150, JR + 0.15, JR - 2.8), -6.05, -0.85, 0.6, 0.4, 3, 3)
    place(bm, 'shell')
    ob = new_obj('Btn_' + key, bm, ['Button'], parent=jc, btn=key, label=f'{key} 键')
    smooth_by_angle(ob)
    ob['press'] = gl((0, 0, -0.6))

    # ---- 扳机 ZL/ZR（铰链在顶部前缘） ----
    key = 'ZL' if side == 'L' else 'ZR'
    piv = Vector((s * (XC + 14.0), 0.9, ZT))
    zp = empty('Btn_' + key, loc=piv, parent=jc, btn=key, label=f'{key} 键',
               pressAxis=gl((1, 0, 0)), pressAngle=-11.0)
    bm = rslab(band_profile(s, XC + 4.9, 168, JR + 0.15, 9.0), 0.35, YB + 6.0, 0.5, 3.2, 3, 6)
    place(bm, 'shell')
    zm = new_obj(f'Btn_{key}_Mesh', bm, ['Button'])
    smooth_by_angle(zm)
    for v in zm.data.vertices:
        v.co -= piv
    zm.location = piv
    set_parent(zm, zp)
    zm['btn'] = key
    zm['label'] = f'{key} 键'

    # ---- 背面解锁按钮 ----
    bm, _ = round_button(2.15, 0.55, -1.2, 0.35, 0.05, 28)
    place(bm, 'back', (s * (XC + 4.2), YB, 38.0))
    new_obj(f'Release_{side}', bm, ['Button'], parent=jc, release=side,
            label=f'Joy-Con（{side}）解锁按钮（点击拆下 / 装上）', press=gl((0, -0.4, 0)))

    # ---- 红外摄像头 ----
    if side == 'R':
        bm = rslab(rrect_c(8.6, 5.0, 1.2), -0.35, -0.05, 0.0, 0.15, 1, 2)
        place(bm, 'bottom', (95.6, -0.8, -ZT))
        new_obj('IRCamera', bm, ['IRWindow'], parent=jc, info='红外线动态摄像头')

    build_rail(jc, side)
    return jc


def build_stick(jc, side, x, z):
    piv = Vector((x, YF + STICK_PIVOT, z))
    st = empty('Stick_' + side, loc=piv, parent=jc, stick=side,
               label=('左' if side == 'L' else '右') + '摇杆（可拖动 / 点击按下）',
               btn='LS' if side == 'L' else 'RS', press=gl((0, 0.9, 0)), tilt=17.0)
    R = STICK_R
    face = STICK_PIVOT
    # 球面罩
    tmax = radians(62)
    dome = [(0.0, R)]
    for i in range(1, 25):
        t = tmax * i / 24
        dome.append((R * sin(t), R * cos(t)))
    Ri = R - 0.8
    for i in range(24, 0, -1):
        t = tmax * i / 24
        dome.append((Ri * sin(t), Ri * cos(t)))
    dome.append((0.0, Ri))
    bm_dome = lathe(dome, 96)
    # 摇杆轴
    bm_shaft = lathe([(0, R - 0.4), (2.55, R - 0.4), (2.55, face + 6.1), (2.2, face + 6.3), (0, face + 6.3)], 32)
    # 摇杆帽：凹面 + 同心纹 + 外沿
    top = face + 8.5
    dish = top - 0.45
    cap = [(0.0, dish)]
    n = 26
    for i in range(1, n + 1):
        rr = 5.7 * i / n
        ridge = 0.045 if i % 2 == 0 else -0.045
        cap.append((rr, dish + 0.011 * rr * rr + (ridge if i < n else 0)))
    cap += [(6.15, top - 0.02), (6.6, top), (7.0, top - 0.06), (7.35, top - 0.25),
            (7.6, top - 0.6), (7.7, top - 1.0), (7.7, face + 6.7), (7.5, face + 6.3),
            (7.1, face + 6.1), (0.0, face + 6.1)]
    bm_cap = lathe(cap, 96)
    bm = combine((bm_dome, 1), (bm_shaft, 1), (bm_cap, 0))
    place(bm, 'front')
    ob = new_obj(f'Stick_{side}_Mesh', bm, ['StickCap', 'StickDome'], loc=piv)
    smooth_by_angle(ob, 40)
    set_parent(ob, st)
    ob['stick'] = side
    ob['label'] = st['label']


def build_rail(jc, side):
    """Joy-Con 内侧滑轨：SL / SR、玩家指示灯、同步键、触点。
    局部坐标：w = 离开手柄内侧面、朝主机方向；两侧的 w 数值相同（frame 负责镜像）。"""
    frame = 'right' if side == 'L' else 'left'
    base = -(XC + GAP + 0.1)          # 手柄内侧面稍里一点
    tip = -(XC - 3.1)                 # 滑轨顶面（插进主机滑槽）

    def on_tip(bm, z, lift=0.0):
        for v in bm.verts:
            v.co.z += tip + lift
        return place(bm, frame, (0, 0, z))

    # 滑轨本体
    bm = rslab(rrect_c(5.2, 98.35, 1.0, 6, 0.0, 1.675), base, tip, 0.0, 0.5, 1, 3)   # z: -47.5 … 50.85
    place(bm, frame)
    rail = new_obj(f'JoyCon_{side}_Rail', bm, ['Plastic'], parent=jc,
                   info='Joy-Con 滑轨（插进主机侧面的滑槽）')
    smooth_by_angle(rail)

    # SL / SR（左手柄：上 SL 下 SR；右手柄：上 SR 下 SL）
    top_key, bot_key = ('SL', 'SR') if side == 'L' else ('SR', 'SL')
    prints = bmesh.new()
    for key, zc in ((top_key, 37.0), (bot_key, -35.0)):
        bm = rslab(rrect_c(3.7, 14.0, 1.1, 6), -0.6, 0.35, 0.0, 0.2, 1, 2)
        on_tip(bm, zc)
        name = f'{key}_{side}'
        ob = new_obj('Btn_' + name, bm, ['Button'], parent=jc, btn=name,
                     label=f'{key} 键（{"左" if side == "L" else "右"} Joy-Con）')
        smooth_by_angle(ob)
        ob['press'] = gl(((-0.3 if side == 'L' else 0.3), 0, 0))
        t = text_bm(key, 1.7, 0.03, bold=0.01)
        on_tip(t, zc - 9.4 if zc > 0 else zc + 9.4)
        merge(prints, t)
    new_obj(f'JoyCon_{side}_RailPrint', prints, ['Print'], parent=jc)

    # 玩家指示灯 ×4
    for i in range(4):
        bm = rslab(rrect_c(1.1, 1.7, 0.35, 3), -0.2, 0.08)
        on_tip(bm, 10.5 - i * 3.0)
        new_obj(f'LED_{side}_{i + 1}', bm, ['LED'], parent=jc, led=side, ledIndex=i + 1,
                info='玩家指示灯')
    # 同步键
    bm, _ = round_button(0.95, 0.25, -0.5, 0.2, 0.0, 20)
    on_tip(bm, 17.5)
    new_obj(f'Sync_{side}', bm, ['Button'], parent=jc, info='同步键（配对用）')
    # 触点
    pins = bmesh.new()
    for i in range(10):
        b = rslab(rrect_c(2.0, 0.17, 0.0), -0.1, 0.03)
        on_tip(b, -47.0 + i * 0.33)
        merge(pins, b)
    new_obj(f'JoyCon_{side}_Pins', pins, ['Gold'], parent=jc, info='Joy-Con 触点')
    # 滑轨锁扣（金属小卡舌）
    latch = rslab(rrect_c(1.7, 2.6, 0.4, 3), -0.1, 0.35, 0.0, 0.12, 1, 2)
    on_tip(latch, 45.5)
    new_obj(f'JoyCon_{side}_Latch', latch, ['RailMetal'], parent=jc, info='滑轨锁扣')


# --------------------------------------------------------------------------
# 底座
# --------------------------------------------------------------------------
DOCK_LOC = (0.0, 150.0, -ZT - 30.0)   # 在 Blender 里放在主机后方；网页里会重新摆放
DOCK_SEAT = 1.2                       # 主机插入后底面离插槽底的高度（USB-C 插头座）


def build_dock(root):
    """简化的底座：前挡板、后壳、插槽内 USB-C 插头、侧面 USB、后盖、指示灯、脚垫。
    局部原点 = 插槽底部中心；整体 173 × 104 × 54 mm。"""
    dk = empty('Dock', loc=DOCK_LOC, parent=root, dock=1, label='底座（点击放入 / 取出主机）',
               seat=DOCK_SEAT)
    W = 173.0
    x0, x1 = -W / 2, W / 2
    z0 = -14.0                    # 底面
    s0, s1 = -8.4, 8.4            # 插槽前后壁
    y0, y1 = s0 - 9.0, s1 + 28.2  # 前挡板 9 mm，后壳 28.2 mm → 总深 54 mm
    top = 90.0                    # 顶面（离底面 104 mm）
    parts = []
    # 底板（插槽底面 z = 0）
    bm = rslab(lambda d: rrect(x0 + 1.5, x1 - 1.5, y0 + 2.0, y1 - 2.0, (5,) * 4, 8), z0 + 0.6, 0.0)   # 藏在前后壳里面，避免重面
    parts.append((bm, 0))
    # 前挡板
    bm = rslab(lambda d: rrect(x0 + d, x1 - d, z0 + d, top - d, (6 - d, 6 - d, 9 - d, 9 - d), 8),
               y0, s0, 2.4, 0.8, 5, 2)
    place(bm, 'shell')
    parts.append((bm, 1))
    # 后壳
    bm = rslab(lambda d: rrect(x0 + d, x1 - d, z0 + d, top - d, (6 - d, 6 - d, 9 - d, 9 - d), 8),
               s1, y1, 0.8, 3.5, 2, 6)
    place(bm, 'shell')
    parts.append((bm, 0))
    def local_obj(name, bm, mats, **props):
        o = new_obj(name, bm, mats, **props)
        o.parent = dk
        o.location = (0, 0, 0)
        return o

    ob = local_obj('Dock_Body', combine(*parts), ['Dock', 'DockGloss'],
                   info='底座（放入后切换到 TV 模式）', dock=1, label=dk['label'])
    smooth_by_angle(ob)

    # 插槽里的 USB-C 插头和底座
    plug = combine((rslab(pill_c(8.2, 2.4), -1.0, 5.6, 0.0, 0.4, 1, 2), 0),
                   (rslab(rrect_c(15.0, 6.5, 2.0), -0.5, DOCK_SEAT, 0.0, 0.4, 1, 2), 1))
    local_obj('Dock_Plug', plug, ['MetalDark', 'Plastic'], info='底座 USB-C 插头')
    # 左侧 USB-A ×2（在后壳侧面）
    usb = bmesh.new()
    for zc in (14.0, 30.0):
        merge(usb, box_bm(x0 - 0.06, x0 + 0.8, 22.0 - 6.4, 22.0 + 6.4, zc - 2.4, zc + 2.4), 0)
        merge(usb, box_bm(x0 - 0.1, x0 + 0.85, 22.0 - 5.4, 22.0 + 5.4, zc - 1.4, zc + 0.6), 1)
    local_obj('Dock_USB', usb, ['MetalDark', 'PortBlack'], info='USB 2.0 接口 ×2')
    # 后盖缝线（一个矩形框）
    seam = bmesh.new()
    a0, a1, b0, b1, t = x0 + 14, x1 - 14, z0 + 16, top - 18, 0.45
    for (u0, u1, v0, v1) in ((a0, a1, b0, b0 + t), (a0, a1, b1 - t, b1), (a0, a0 + t, b0, b1), (a1 - t, a1, b0, b1)):
        merge(seam, box_bm(u0, u1, y1 - 0.05, y1 + 0.05, v0, v1))
    local_obj('Dock_BackCover', seam, ['Gap'], info='后盖（里面是 HDMI / USB 3.0 / 电源接口）')
    # 正面右下角指示灯
    led = rslab(pill_c(3.4, 1.1), -0.2, 0.06)
    place(led, 'front', (x1 - 15.0, y0, z0 + 7.0))
    local_obj('Dock_LED', led, ['DockLED'], info='TV 输出指示灯')
    # 脚垫
    feet = bmesh.new()
    for sx in (-1, 1):
        for sy in (-1, 1):
            f = cyl_bm(4.0, -0.7, 0.05, 20)
            place(f, 'top', (sx * 70, (y0 + y1) / 2 + sy * 18, z0))
            merge(feet, f)
    local_obj('Dock_Feet', feet, ['Rubber'])
    return dk


# --------------------------------------------------------------------------
# 预览渲染（可选）
# --------------------------------------------------------------------------
def setup_render_scene():
    """给 .blend 准备好相机、灯光和 Cycles 设置，打开后按 F12 就能出图。"""
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'
    sc.cycles.device = 'CPU'
    sc.cycles.samples = 64
    sc.cycles.use_denoising = True
    sc.render.resolution_x = 1920
    sc.render.resolution_y = 1080
    sc.view_settings.view_transform = 'AgX'
    world = bpy.data.worlds.new('Studio')
    sc.world = world
    if world.node_tree is None:
        world.use_nodes = True
    bg = world.node_tree.nodes['Background']
    bg.inputs['Color'].default_value = (0.78, 0.8, 0.84, 1)
    bg.inputs['Strength'].default_value = 0.45
    rig = bpy.data.collections.new('Render')
    sc.collection.children.link(rig)
    for name, loc, energy, size in (('Key', (-250, -400, 350), 6.0e6, 300), ('Fill', (400, -250, 100), 2.5e6, 300),
                                     ('Rim', (0, 400, 300), 3.0e6, 300)):
        ld = bpy.data.lights.new(name, 'AREA')
        ld.energy = energy
        ld.size = size
        lo = bpy.data.objects.new(name, ld)
        lo.location = loc
        lo.rotation_euler = (Vector((0, 0, 0)) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
        rig.objects.link(lo)
    cam_d = bpy.data.cameras.new('Camera')
    cam_d.lens = 85
    cam_d.clip_start = 1
    cam_d.clip_end = 5000
    cam = bpy.data.objects.new('Camera', cam_d)
    rig.objects.link(cam)
    sc.camera = cam
    aim(cam, (-330, -470, 210), (0, 0, 0))
    return cam


def aim(ob, loc, target):
    ob.location = loc
    ob.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()


SHOTS = {
    'front': ((0, -620, 40), (0, 0, 0)),
    'three_quarter': ((-330, -470, 210), (0, 0, 0)),
    'back': ((260, 560, 160), (0, 0, 0)),
    'top': ((60, -120, 420), (40, 0, 40)),
    'joycon_l': ((-200, -230, 90), (-103, 0, 5)),
    'joycon_r': ((200, -230, 60), (103, 0, 0)),
    'bottom': ((40, -200, -330), (0, 0, -40)),
}


def render_previews(out_dir, cam):
    os.makedirs(out_dir, exist_ok=True)
    sc = bpy.context.scene
    sc.cycles.samples = 48
    sc.render.resolution_x = 1280
    sc.render.resolution_y = 720
    only = os.environ.get('SHOTS')
    for name, (loc, tgt) in SHOTS.items():
        if only and name not in only.split(','):
            continue
        aim(cam, loc, tgt)
        sc.render.filepath = os.path.join(out_dir, name + '.png')
        bpy.ops.render.render(write_still=True)
        print('rendered', sc.render.filepath)


# --------------------------------------------------------------------------
def main():
    global COLL
    sc = reset_scene()
    COLL = sc.collection
    make_materials()
    root = empty('Switch', label='Switch 风格掌机（非官方粉丝模型）')
    build_console(root)
    build_joycon(root, 'L')
    build_joycon(root, 'R')
    if '--no-dock' not in ARGV:
        build_dock(root)

    for ob in bpy.data.objects:
        if ob.type == 'MESH' and ob.name != 'Console_Glass':      # 屏幕玻璃保留屏幕区域的 UV
            box_uv(ob)

    os.makedirs(os.path.dirname(OUT_GLB), exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=OUT_GLB, export_format='GLB', export_apply=True, export_extras=True,
        export_yup=True, export_cameras=False, export_texcoords=True, export_normals=True,
        export_animations=False, export_materials='EXPORT')
    print('exported', OUT_GLB, os.path.getsize(OUT_GLB) // 1024, 'KiB')

    tris = 0
    for ob in bpy.data.objects:
        if ob.type == 'MESH':
            tris += sum(len(p.vertices) - 2 for p in ob.data.polygons)
    print('objects', len(bpy.data.objects), 'approx triangles', tris)

    cam = setup_render_scene()        # 在导出 GLB 之后再加相机灯光，GLB 里只有模型
    if '--no-blend' not in ARGV:
        bpy.context.preferences.filepaths.save_version = 0     # 不生成 .blend1 备份
        bpy.ops.wm.save_as_mainfile(filepath=OUT_BLEND, compress=True)
        print('saved', OUT_BLEND)
    if '--render' in ARGV:
        out_dir = ARGV[ARGV.index('--render') + 1]
        render_previews(out_dir, cam)


if __name__ == '__main__':
    main()
