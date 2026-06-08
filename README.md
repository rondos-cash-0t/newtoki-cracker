# newtoki-cracker

Original source by https://github.com/FilteringDev/newtoki-cracker

## 이 스크립트를 공개하면 바로 패치되어 더 이상 유지보수를 진행하지 않습니다.
코드를 수정하여 정상적으로 작동하도록 만들 수는 있으나, 금방 패치 될 것으로 보이므로 더 이상 유지보수를 진행하지 않습니다.

다만, 자유롭게 Fork 하여 수정할 수 있도록 코드는 공개해 두겠습니다.


### 저격 패치 (layout.js 중 일부)
```js
...
                    if (document.getElementById("ntk-hide-ad-style") || (0,
                    o.BA)() || (0,
                    o.Vb)('[data-br] img[data-ntk-blocked="1"]').length > 0)
                        return void E("userscript_spoof");
                    if (window.location.href !== M) {
                        if (M = window.location.href,
                        N = 0,
                        T = 0,
...
```

### 이 스크립트를 추가하면 해당 사이트에서 IP 밴 등, 접속하지 못 할 수 있습니다.
### 최근 추가된 코드는 탭의 고유 ID 를 이용한 캐시 스토리지 등을 이용하고 있으므로, 되도록이면 모바일에서 디버그를 하시는 것을 추천합니다.
### [Add Userscript](https://raw.githubusercontent.com/rondos-cash-0t/newtoki-cracker/refs/heads/main/sbxh.user.js)
