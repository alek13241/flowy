var flowy = function(canvas, grab, release, snapping, rearrange, spacing_x, spacing_y) {
    if (!grab) {
        grab = function() {};
    }
    if (!release) {
        release = function() {};
    }
    if (!snapping) {
        snapping = function() {
            return true;
        }
    }
    if (!rearrange) {
        rearrange = function() {
            return false;
        }
    }
    if (!spacing_x) {
        spacing_x = 20;
    }
    if (!spacing_y) {
        spacing_y = 80;
    }
    if (!Element.prototype.matches) {
        Element.prototype.matches = Element.prototype.msMatchesSelector ||
            Element.prototype.webkitMatchesSelector;
    }
    if (!Element.prototype.closest) {
        Element.prototype.closest = function(s) {
            var el = this;
            do {
                if (Element.prototype.matches.call(el, s)) return el;
                el = el.parentElement || el.parentNode;
            } while (el !== null && el.nodeType === 1);
            return null;
        };
    }
    var loaded = false;
    flowy.load = function() {
        if (!loaded)
            loaded = true;
        else
            return;
        var blocks = [];
        var blockstemp = [];
        var canvas_div = canvas;
        var absx = 0;
        var absy = 0;
        if (window.getComputedStyle(canvas_div).position == "absolute" || window.getComputedStyle(canvas_div).position == "fixed") {
            absx = canvas_div.getBoundingClientRect().left;
            absy = canvas_div.getBoundingClientRect().top;
        }
        var active = false;
        var paddingx = spacing_x;
        var paddingy = spacing_y;
        var offsetleft = 0;
        var rearrange = false;
        var drag, dragx, dragy, original;
        var mouse_x, mouse_y;
        
        var prevblock = [0];
        var el = document.createElement("DIV");
        el.classList.add('indicator');
        el.classList.add('invisible');
        canvas_div.appendChild(el);

        var dragblock = false;
        var dragindicator = false;
        var dargindicatorblock = 0;
        var connecting = false
        
        flowy.import = function(output) {
            canvas_div.innerHTML = output.html;
            for (var a = 0; a < output.blockarr.length; a++) {
                blocks.push({
                    childwidth: parseFloat(output.blockarr[a].childwidth),
                    parent: output.blockarr[a].parent,
                    id: parseFloat(output.blockarr[a].id),
                    x: parseFloat(output.blockarr[a].x),
                    y: parseFloat(output.blockarr[a].y),
                    width: parseFloat(output.blockarr[a].width),
                    height: parseFloat(output.blockarr[a].height)
                })
            }
            if (blocks.length > 1) {
                rearrangeMe();
                checkOffset();
            }
        }
        flowy.output = function() {
            var html_ser = canvas_div.innerHTML;
            var json_data = {
                html: html_ser,
                blockarr: blocks,
                blocks: []
            };
            if (blocks.length > 0) {
                for (var i = 0; i < blocks.length; i++) {
                    json_data.blocks.push({
                        id: blocks[i].id,
                        parent: blocks[i].parent,
                        data: [],
                        attr: []
                    });
                    var blockParent = document.querySelector(".blockid[value='" + blocks[i].id + "']").parentNode;
                    blockParent.querySelectorAll("input").forEach(function(block) {
                        var json_name = block.getAttribute("name");
                        var json_value = block.value;
                        json_data.blocks[i].data.push({
                            name: json_name,
                            value: json_value
                        });
                    });
                    Array.prototype.slice.call(blockParent.attributes).forEach(function(attribute) {
                        var jsonobj = {};
                        jsonobj[attribute.name] = attribute.value;
                        json_data.blocks[i].attr.push(jsonobj);
                    });
                }
                return json_data;
            }
        }
        flowy.deleteBlocks = function() {
            blocks = [];
            canvas_div.innerHTML = "<div class='indicator invisible'></div>";
        }

        flowy.beginDrag = function(event) {
            if (window.getComputedStyle(canvas_div).position == "absolute" || window.getComputedStyle(canvas_div).position == "fixed") {
                absx = canvas_div.getBoundingClientRect().left;
                absy = canvas_div.getBoundingClientRect().top;
            }
            if (event.targetTouches) {
                mouse_x = event.changedTouches[0].clientX;
                mouse_y = event.changedTouches[0].clientY;
            } else {
                mouse_x = event.clientX;
                mouse_y = event.clientY;
            }
            if (event.which != 3 && event.target.closest(".create-flowy")) {
                original = event.target.closest(".create-flowy");
                var newNode = event.target.closest(".create-flowy").cloneNode(true);
                event.target.closest(".create-flowy").classList.add("dragnow");
                newNode.classList.add("block");
                newNode.classList.remove("create-flowy");
                if (blocks.length === 0) {
                    newNode.innerHTML += "<input type='hidden' name='blockid' class='blockid' value='" + blocks.length + "'>";
                    document.body.appendChild(newNode);
                    drag = document.querySelector(".blockid[value='" + blocks.length + "']").parentNode;
                } else {
                    newNode.innerHTML += "<input type='hidden' name='blockid' class='blockid' value='" + (Math.max.apply(Math, blocks.map(a => a.id)) + 1) + "'>";
                    document.body.appendChild(newNode);
                    drag = document.querySelector(".blockid[value='" + (parseInt(Math.max.apply(Math, blocks.map(a => a.id))) + 1) + "']").parentNode;
                }
                blockGrabbed(event.target.closest(".create-flowy"));
                drag.classList.add("dragging");
                active = true;
                dragx = mouse_x - (event.target.closest(".create-flowy").getBoundingClientRect().left);
                dragy = mouse_y - (event.target.closest(".create-flowy").getBoundingClientRect().top);
                drag.style.left = mouse_x - dragx + "px";
                drag.style.top = mouse_y - dragy + "px";
            }
        }

        flowy.endDrag = function(event) {
            if (event.which != 3 && dragindicator) {
                dragindicator = false
                connecting = true
                blockReleased();
                if (!document.querySelector(".indicator").classList.contains("invisible")) {
                    document.querySelector(".indicator").classList.add("invisible");
                }
                if (hasParentClass(event.target, 'block')) {
                    const theblock = event.target.closest(".block");
                    const blockid = theblock.querySelector('.blockid').value;
                    if (blockid !== dargindicatorblock) {
                        var blocko = blocks.map(a => a.id);
                        snap(theblock, dargindicatorblock, blocko);
                    }
                }
            } else if (event.which != 3 && (active || rearrange)) {
                dragblock = false;
                blockReleased();
                if (!document.querySelector(".indicator").classList.contains("invisible")) {
                    document.querySelector(".indicator").classList.add("invisible");
                }
                if (active) {
                    original.classList.remove("dragnow");
                    drag.classList.remove("dragging");
                }
                if (parseInt(drag.querySelector(".blockid").value) === 0 && rearrange) {
                    firstBlock("rearrange")    
                } else if (active && blocks.length == 0 && (drag.getBoundingClientRect().top + window.scrollY) > (canvas_div.getBoundingClientRect().top + window.scrollY) && (drag.getBoundingClientRect().left + window.scrollX) > (canvas_div.getBoundingClientRect().left + window.scrollX)) {
                    firstBlock("drop");
                } else if (active && blocks.length == 0) {
                    removeSelection();
                } else if (active) {
                    var blocko = blocks.map(a => a.id);
                    for (var i = 0; i < blocks.length; i++) {
                        if (checkAttach(blocko[i])) {
                            active = false;
                            if (blockSnap(drag, false, document.querySelector(".blockid[value='" + blocko[i] + "']").parentNode)) {
                                snap(drag, i, blocko);
                                const dragChildren = drag.querySelector(".blockchildren")
                                if (dragChildren) {
                                    const blockChildren = dragChildren.value.split(',').map((id) => parseInt(id.trim()))
                                    var index = blocks.length - 1;
                                    var dragId = drag.querySelector(".blockid").value
                                    for (const blockChild of blockChildren) {
                                        var blocko = blocks.map(a => a.id);
                                        dragId ++;
                                        console.log(blockChild)
                                        drag.querySelector(".blockid").value = dragId
                                        drag.querySelector(".blockelemtype").value = blockChild
                                        if (blockSnap(drag, false, document.querySelector(".blockid[value='" + index + "']").parentNode)){
                                            snap(drag, index, blocko)
                                        }
                                    }
                                }
                                
                            } else {
                                active = false;
                                removeSelection();
                            }
                            break;
                        } else if (i == blocks.length - 1) {
                            active = false;
                            removeSelection();
                        }
                    }
                } else if (rearrange) {
                    var blocko = blocks.map(a => a.id);
                    for (var i = 0; i < blocks.length; i++) {
                        if (checkAttach(blocko[i])) {
                            active = false;
                            drag.classList.remove("dragging");
                            snap(drag, i, blocko);
                            break;
                        } else if (i == blocks.length - 1) {
                            if (beforeDelete(drag, blocks.filter(id => id.id == blocko[i])[0])) {
                                active = false;
                                drag.classList.remove("dragging");
                                for (var i = 0; i < prevblock.length; i ++) {
                                    snap(drag, blocko.indexOf(prevblock[i]), blocko);
                                }
                                break;
                            } else {
                                rearrange = false;
                                blockstemp = [];
                                active = false;
                                removeSelection();
                                break;
                            }
                        }
                    }
                }
            }
        }
        
        function checkAttach(id) {
            const xpos = (drag.getBoundingClientRect().left + window.scrollX) + (parseInt(window.getComputedStyle(drag).width) / 2) + canvas_div.scrollLeft - canvas_div.getBoundingClientRect().left;
            const ypos = (drag.getBoundingClientRect().top + window.scrollY) + canvas_div.scrollTop - canvas_div.getBoundingClientRect().top;
            const theblock = document.querySelector(".blockid[value='" + id + "']").parentNode;
            var theblockElemContainer = theblock.querySelector(".blockycontainer")
            if (theblockElemContainer && theblockElemContainer.getAttribute('strictchild') == 'true') {
                return
            }
            if (xpos >= blocks.filter(a => a.id == id)[0].x - (blocks.filter(a => a.id == id)[0].width / 2) - paddingx && xpos <= blocks.filter(a => a.id == id)[0].x + (blocks.filter(a => a.id == id)[0].width / 2) + paddingx && ypos >= blocks.filter(a => a.id == id)[0].y - (blocks.filter(a => a.id == id)[0].height / 2) && ypos <= blocks.filter(a => a.id == id)[0].y + blocks.filter(a => a.id == id)[0].height) {
                return true;   
            } else {
                return false;
            }
        }
        
        function removeSelection() {
            canvas_div.appendChild(document.querySelector(".indicator"));
            drag.parentNode.removeChild(drag);
        }
        
        function firstBlock(type) {
            if (type == "drop") {
                blockSnap(drag, true, undefined);
                active = false;
                drag.style.top = (drag.getBoundingClientRect().top + window.scrollY) - (absy + window.scrollY) + canvas_div.scrollTop + "px";
                drag.style.left = (drag.getBoundingClientRect().left + window.scrollX) - (absx + window.scrollX) + canvas_div.scrollLeft + "px";
                canvas_div.appendChild(drag);
                blocks.push({
                    parent: [-1],
                    childwidth: 0,
                    id: parseInt(drag.querySelector(".blockid").value),
                    x: (drag.getBoundingClientRect().left + window.scrollX) + (parseInt(window.getComputedStyle(drag).width) / 2) + canvas_div.scrollLeft - canvas_div.getBoundingClientRect().left,
                    y: (drag.getBoundingClientRect().top + window.scrollY) + (parseInt(window.getComputedStyle(drag).height) / 2) + canvas_div.scrollTop - canvas_div.getBoundingClientRect().top,
                    width: parseInt(window.getComputedStyle(drag).width),
                    height: parseInt(window.getComputedStyle(drag).height)
                });
            } else if (type == "rearrange") {
                drag.classList.remove("dragging");
                rearrange = false;
                for (var w = 0; w < blockstemp.length; w++) {
                    if (blockstemp[w].id != parseInt(drag.querySelector(".blockid").value)) {
                        const blockParent = document.querySelector(".blockid[value='" + blockstemp[w].id + "']").parentNode;
                        const arrowParent = document.querySelector(".arrowid[value='" + blockstemp[w].id + "']").parentNode;
                        blockParent.style.left = (blockParent.getBoundingClientRect().left + window.scrollX) - (window.scrollX) + canvas_div.scrollLeft - 1 - absx + "px";
                        blockParent.style.top = (blockParent.getBoundingClientRect().top + window.scrollY) - (window.scrollY) + canvas_div.scrollTop - absy - 1 + "px";
                        arrowParent.style.left = (arrowParent.getBoundingClientRect().left + window.scrollX) - (window.scrollX) + canvas_div.scrollLeft - absx - 1 + "px";
                        arrowParent.style.top = (arrowParent.getBoundingClientRect().top + window.scrollY) + canvas_div.scrollTop - 1 - absy + "px";
                        canvas_div.appendChild(blockParent);
                        canvas_div.appendChild(arrowParent);
                        blockstemp[w].x = (blockParent.getBoundingClientRect().left + window.scrollX) + (parseInt(blockParent.offsetWidth) / 2) + canvas_div.scrollLeft - canvas_div.getBoundingClientRect().left - 1;
                        blockstemp[w].y = (blockParent.getBoundingClientRect().top + window.scrollY) + (parseInt(blockParent.offsetHeight) / 2) + canvas_div.scrollTop - canvas_div.getBoundingClientRect().top - 1;
                    }
                }
                blockstemp.filter(a => a.id == 0)[0].x = (drag.getBoundingClientRect().left + window.scrollX) + (parseInt(window.getComputedStyle(drag).width) / 2) + canvas_div.scrollLeft - canvas_div.getBoundingClientRect().left;
                blockstemp.filter(a => a.id == 0)[0].y = (drag.getBoundingClientRect().top + window.scrollY) + (parseInt(window.getComputedStyle(drag).height) / 2) + canvas_div.scrollTop - canvas_div.getBoundingClientRect().top;
                blocks = blocks.concat(blockstemp);
                blockstemp = [];
            }
        }
        
        function drawArrow(arrow, parent_id, x, y, id) {
            const arrowid = arrow.id + '_' + parent_id
            if (x < 0) {
                canvas_div.innerHTML += '<div class="arrowblock"><input type="hidden" class="arrowid" value="' + arrowid + '"><svg preserveaspectratio="none" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M' + (blocks.filter(a => a.id == id)[0].x - arrow.x + 5) + ' 0L' + (blocks.filter(a => a.id == id)[0].x - arrow.x + 5) + ' ' + (y - (paddingy / 2)) + 'L5 ' + (y - (paddingy / 2)) + 'L5 ' + y + '" stroke="#C5CCD0" stroke-width="2px"/><path d="M0 ' + (y - 5) + 'H10L5 ' + y + 'L0 ' + (y - 5) + 'Z" fill="#C5CCD0"/></svg></div>';
                document.querySelector('.arrowid[value="' + arrowid + '"]').parentNode.style.left = (arrow.x - 5) - (absx + window.scrollX) + canvas_div.scrollLeft + canvas_div.getBoundingClientRect().left + "px";
            } else {
                canvas_div.innerHTML += '<div class="arrowblock"><input type="hidden" class="arrowid" value="' + arrowid + '"><svg preserveaspectratio="none" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M20 0L20 ' + (y - (paddingy / 2)) + 'L' + (x) + ' ' + (y - (paddingy / 2)) + 'L' + x + ' ' + y + '" stroke="#C5CCD0" stroke-width="2px"/><path d="M' + (x - 5) + ' ' + (y - 5) + 'H' + (x + 5) + 'L' + x + ' ' + y + 'L' + (x - 5) + ' ' + (y - 5) + 'Z" fill="#C5CCD0"/></svg></div>';
                document.querySelector('.arrowid[value="' + arrowid + '"]').parentNode.style.left = blocks.filter(a => a.id == id)[0].x - 20 - (absx + window.scrollX) + canvas_div.scrollLeft + canvas_div.getBoundingClientRect().left + "px";
            }
            document.querySelector('.arrowid[value="' + arrowid + '"]').parentNode.style.top = blocks.filter(a => a.id == id)[0].y + (blocks.filter(a => a.id == id)[0].height / 2) + canvas_div.getBoundingClientRect().top - absy + "px";
        }
        
        function updateArrow(arrow, parent_id, x, y, children) {
            const arrowid = children.id + '_' + parent_id
            if (x < 0) {
                document.querySelector('.arrowid[value="' + arrowid + '"]').parentNode.style.left = (arrow.x - 5) - (absx + window.scrollX) + canvas_div.getBoundingClientRect().left + "px";
                document.querySelector('.arrowid[value="' + arrowid + '"]').parentNode.innerHTML = '<input type="hidden" class="arrowid" value="' + arrowid + '"><svg preserveaspectratio="none" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M' + (blocks.filter(id => id.id == parent_id)[0].x - arrow.x + 5) + ' 0L' + (blocks.filter(id => id.id == parent_id)[0].x - arrow.x + 5) + ' ' + (y - (paddingy / 2)) + 'L5 ' + (y - (paddingy / 2)) + 'L5 ' + y + '" stroke="#C5CCD0" stroke-width="2px"/><path d="M0 ' + (y - 5) + 'H10L5 ' + y + 'L0 ' + (y - 5) + 'Z" fill="#C5CCD0"/></svg>';
            } else {
                document.querySelector('.arrowid[value="' + arrowid + '"]').parentNode.style.left = blocks.filter(id => id.id == parent_id)[0].x - 20 - (absx + window.scrollX) + canvas_div.getBoundingClientRect().left + "px";
                document.querySelector('.arrowid[value="' + arrowid + '"]').parentNode.innerHTML = '<input type="hidden" class="arrowid" value="' + arrowid + '"><svg preserveaspectratio="none" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M20 0L20 ' + (y - (paddingy / 2)) + 'L' + (x) + ' ' + (y - (paddingy / 2)) + 'L' + x + ' ' + y + '" stroke="#C5CCD0" stroke-width="2px"/><path d="M' + (x - 5) + ' ' + (y - 5) + 'H' + (x + 5) + 'L' + x + ' ' + y + 'L' + (x - 5) + ' ' + (y - 5) + 'Z" fill="#C5CCD0"/></svg>';
            }
        }

        function snap(drag, i, blocko) {
            if (!rearrange && !connecting) {
                canvas_div.appendChild(drag);
            }
            var totalwidth = 0;
            var totalremove = 0;
            var maxheight = 0;
            if (!connecting) {
                for (var w = 0; w < blocks.filter(id => id.parent.indexOf(blocko[i]) >= 0).length; w++) {
                    var children = blocks.filter(id => id.parent.indexOf(blocko[i]) >= 0)[w];
                    if (children.childwidth > children.width) {
                        totalwidth += children.childwidth + paddingx;
                    } else {
                        totalwidth += children.width + paddingx;
                    }
                }
                totalwidth += parseInt(window.getComputedStyle(drag).width);
                for (var w = 0; w < blocks.filter(id => id.parent.indexOf(blocko[i]) >= 0).length; w++) {
                    var children = blocks.filter(id => id.parent.indexOf(blocko[i]) >= 0)[w];
                    if (children.childwidth > children.width) {
                        document.querySelector(".blockid[value='" + children.id + "']").parentNode.style.left = blocks.filter(a => a.id == blocko[i])[0].x - (totalwidth / 2) + totalremove + (children.childwidth / 2) - (children.width / 2) + "px";
                        children.x = blocks.filter(id => id.parent.indexOf(blocko[i]) >= 0)[0].x - (totalwidth / 2) + totalremove + (children.childwidth / 2);
                        totalremove += children.childwidth + paddingx;
                    } else {
                        document.querySelector(".blockid[value='" + children.id + "']").parentNode.style.left = blocks.filter(a => a.id == blocko[i])[0].x - (totalwidth / 2) + totalremove + "px";
                        children.x = blocks.filter(id => id.parent.indexOf(blocko[i]) >= 0)[0].x - (totalwidth / 2) + totalremove + (children.width / 2);
                        totalremove += children.width + paddingx;
                    }
                }
            }
            if (!connecting) {
                drag.style.left = blocks.filter(id => id.id == blocko[i])[0].x - (totalwidth / 2) + totalremove - (window.scrollX + absx) + canvas_div.scrollLeft + canvas_div.getBoundingClientRect().left + "px";
                drag.style.top = blocks.filter(id => id.id == blocko[i])[0].y + (blocks.filter(id => id.id == blocko[i])[0].height / 2) + paddingy - (window.scrollY + absy) + canvas_div.getBoundingClientRect().top + "px";
            }
            if (rearrange) {
                blockstemp.filter(a => a.id == parseInt(drag.querySelector(".blockid").value))[0].x = (drag.getBoundingClientRect().left + window.scrollX) + (parseInt(window.getComputedStyle(drag).width) / 2) + canvas_div.scrollLeft - canvas_div.getBoundingClientRect().left;
                blockstemp.filter(a => a.id == parseInt(drag.querySelector(".blockid").value))[0].y = (drag.getBoundingClientRect().top + window.scrollY) + (parseInt(window.getComputedStyle(drag).height) / 2) + canvas_div.scrollTop - canvas_div.getBoundingClientRect().top;
                blockstemp.filter(a => a.id == drag.querySelector(".blockid").value)[0].parent = [blocko[i]];
                for (var w = 0; w < blockstemp.length; w++) {
                    if (blockstemp[w].id != parseInt(drag.querySelector(".blockid").value)) {
                        const blockParent = document.querySelector(".blockid[value='" + blockstemp[w].id + "']").parentNode;
                        blockParent.style.left = (blockParent.getBoundingClientRect().left + window.scrollX) - (window.scrollX + canvas_div.getBoundingClientRect().left) + canvas_div.scrollLeft + "px";
                        blockParent.style.top = (blockParent.getBoundingClientRect().top + window.scrollY) - (window.scrollY + canvas_div.getBoundingClientRect().top) + canvas_div.scrollTop + "px";
                        canvas_div.appendChild(blockParent);

                        let currentBlockParents = blockstemp[w].parent;
                        currentBlockParents = currentBlockParents.filter((blockParent) => blockstemp.some((blocktemp) => blocktemp.id == blockParent) >= 0)
                        for (var j = 0; j < currentBlockParents.length; j ++) {
                            const arrowid = blockstemp[w].id + '_' + currentBlockParents[i]
                            const arrowParent = document.querySelector(".arrowid[value='" + arrowid + "']").parentNode;
                            arrowParent.style.left = (arrowParent.getBoundingClientRect().left + window.scrollX) - (window.scrollX + canvas_div.getBoundingClientRect().left) + canvas_div.scrollLeft + 20 + "px";
                            arrowParent.style.top = (arrowParent.getBoundingClientRect().top + window.scrollY) - (window.scrollY + canvas_div.getBoundingClientRect().top) + canvas_div.scrollTop + "px";
                            canvas_div.appendChild(arrowParent);
                        }
                        
                        blockstemp[w].x = (blockParent.getBoundingClientRect().left + window.scrollX) + (parseInt(window.getComputedStyle(blockParent).width) / 2) + canvas_div.scrollLeft - canvas_div.getBoundingClientRect().left;
                        blockstemp[w].y = (blockParent.getBoundingClientRect().top + window.scrollY) + (parseInt(window.getComputedStyle(blockParent).height) / 2) + canvas_div.scrollTop - canvas_div.getBoundingClientRect().top;
                    }
                }
                blocks = blocks.concat(blockstemp);
                blockstemp = [];
            } else if (connecting) {
                const currentblock = blocks.filter((id) => id.id == drag.querySelector(".blockid").value)[0]
                if (currentblock.parent.indexOf(blocko[i]) === -1) {
                    currentblock.parent.push(blocko[i])
                }
            } else {
                blocks.push({
                    childwidth: 0,
                    parent: [blocko[i]],
                    id: parseInt(drag.querySelector(".blockid").value),
                    x: (drag.getBoundingClientRect().left + window.scrollX) + (parseInt(window.getComputedStyle(drag).width) / 2) + canvas_div.scrollLeft - canvas_div.getBoundingClientRect().left,
                    y: (drag.getBoundingClientRect().top + window.scrollY) + (parseInt(window.getComputedStyle(drag).height) / 2) + canvas_div.scrollTop - canvas_div.getBoundingClientRect().top,
                    width: parseInt(window.getComputedStyle(drag).width),
                    height: parseInt(window.getComputedStyle(drag).height)
                });
            }
            
            var arrowblock = blocks.filter(a => a.id == parseInt(drag.querySelector(".blockid").value))[0];
            const parentblock = blocks.filter(a => a.id == blocko[i])[0]
            var arrowx = arrowblock.x - parentblock.x + 20;
            var arrowy = arrowblock.y - parentblock.y - arrowblock.height;
            drawArrow(arrowblock, blocko[i], arrowx, arrowy, blocko[i]);
            
            if (!connecting) {
                if (blocks.filter(a => a.id == blocko[i])[0].parent[0] != -1) {
                    var flag = false;
                    var idval = blocko[i];
                    while (!flag) {
                        if (blocks.filter(a => a.id == idval)[0].parent[0] == -1) {
                            flag = true;
                        } else {
                            var zwidth = 0;
                            for (var w = 0; w < blocks.filter(id => id.parent.indexOf(idval) >= 0).length; w++) {
                                var children = blocks.filter(id => id.parent.indexOf(idval) >= 0)[w];
                                if (children.childwidth > children.width) {
                                    if (w == blocks.filter(id => id.parent.indexOf(idval) >= 0).length - 1) {
                                        zwidth += children.childwidth;
                                    } else {
                                        zwidth += children.childwidth + paddingx;
                                    }
                                } else {
                                    if (w == blocks.filter(id => id.parent.indexOf(idval) >= 0).length - 1) {
                                        zwidth += children.width;
                                    } else {
                                        zwidth += children.width + paddingx;
                                    }
                                }
                            }
                            blocks.filter(a => a.id == idval)[0].childwidth = zwidth;
                            idval = blocks.filter(a => a.id == idval)[0].parent[0];
                        }
                    }
                    blocks.filter(id => id.id == idval)[0].childwidth = totalwidth;
                }
            }
            if (rearrange) {
                rearrange = false;
                drag.classList.remove("dragging");
            }
            if (connecting) {
                connecting = false
            }
            rearrangeMe();
            checkOffset();
        }

        function touchblock(event) {
            dragblock = false;
            if (hasParentClass(event.target, "indicator")) {
                if (event.type !== "mouseup" && event.which != 3) {
                    console.log('checking current status', active, rearrange, dragblock)
                    if (!active && !rearrange && !dragblock) {
                        dragindicator = true;
                        var theblock = event.target.closest(".block");
                        dargindicatorblock = theblock.querySelector('.blockid').value
                    }
                }
            } else if (hasParentClass(event.target, "block")) {
                var theblock = event.target.closest(".block");
                var theblockElemContainer = theblock.querySelector(".blockycontainer")
                if (theblockElemContainer && theblockElemContainer.getAttribute('movedisabled') == 'true') {
                    return
                }
                if (event.targetTouches) {
                    mouse_x = event.targetTouches[0].clientX;
                    mouse_y = event.targetTouches[0].clientY;
                } else {
                    mouse_x = event.clientX;
                    mouse_y = event.clientY;
                }
                if (event.type !== "mouseup" && hasParentClass(event.target, "block")) {
                    if (event.which != 3) {
                        if (!active && !rearrange) {
                            dragblock = true;
                            drag = theblock;
                            dragx = mouse_x - (drag.getBoundingClientRect().left + window.scrollX);
                            dragy = mouse_y - (drag.getBoundingClientRect().top + window.scrollY);
                        }
                    }
                }
            }
        }

        function mousehoverblock(event) {
            if (hasParentClass(event.target, "block")) {
                var theblock = event.target.closest(".block");
                if (event.targetTouches) {
                    mouse_x = event.targetTouches[0].clientX;
                    mouse_y = event.targetTouches[0].clientY;
                } else {
                    mouse_x = event.clientX;
                    mouse_y = event.clientY;
                }

                if (!dragindicator && !dragblock && !active && !rearrange) {
                    var theblockElemContainer = theblock.querySelector(".blockycontainer")
                    if (theblockElemContainer && theblockElemContainer.getAttribute('strictchild') == 'true') {
                        return
                    }
                    const theblockBottom = theblock.getBoundingClientRect().bottom;
                    if (Math.abs(mouse_y - theblockBottom) < 10) {
                        theblock.appendChild(document.querySelector(".indicator"));
                        document.querySelector(".indicator").style.left = (theblock.offsetWidth / 2) - 5 + "px";
                        document.querySelector(".indicator").style.top = theblock.offsetHeight + "px";
                        document.querySelector(".indicator").classList.remove("invisible");
                    }
                }
            }
        }

        function mouseleaveblock(event) {
            console.log(event)
            if (hasParentClass(event.target, "block")) {
                console.log('find block')
                if (!document.querySelector(".indicator").classList.contains("invisible")) {
                    document.querySelector(".indicator").classList.add("invisible");
                }
            }
        }



        function hasParentClass(element, classname) {
            if (element.className) {
                if (element.className.split(' ').indexOf(classname) >= 0) return true;
            }
            return element.parentNode && hasParentClass(element.parentNode, classname);
        }

        flowy.moveBlock = function(event) {
            if (event.targetTouches) {
                mouse_x = event.targetTouches[0].clientX;
                mouse_y = event.targetTouches[0].clientY;
            } else {
                mouse_x = event.clientX;
                mouse_y = event.clientY;
            }
            if (dragblock) {
                rearrange = true;
                drag.classList.add("dragging");
                var blockid = parseInt(drag.querySelector(".blockid").value);
                prevblock = blocks.filter(a => a.id == blockid)[0].parent;
                blockstemp.push(blocks.filter(a => a.id == blockid)[0]);
                blocks = blocks.filter(function(e) {
                    return e.id != blockid
                });
                if (blockid != 0) {
                    for (var i = 0; i < prevblock.length; i ++) {
                        const arrowid = blockid + '_' + prevblock[i]
                        document.querySelector(".arrowid[value='" + arrowid + "']").parentNode.remove();
                    }
                }
                var layer = blocks.filter(a => a.parent.indexOf(blockid) >= 0);
                var flag = false;
                var foundids = [];
                var allids = [];
                while (!flag) {
                    for (var i = 0; i < layer.length; i++) {
                        if (layer[i] != blockid) {
                            const currentblock = blocks.filter(a => a.id == layer[i].id)[0];
                            blockstemp.push(currentblock);
                            const blockParent = document.querySelector(".blockid[value='" + layer[i].id + "']").parentNode;
                            blockParent.style.left = (blockParent.getBoundingClientRect().left + window.scrollX) - (drag.getBoundingClientRect().left + window.scrollX) + "px";
                            blockParent.style.top = (blockParent.getBoundingClientRect().top + window.scrollY) - (drag.getBoundingClientRect().top + window.scrollY) + "px";
                            drag.appendChild(blockParent);
                            let currentBlockParents = currentblock.parent;
                            currentBlockParents = currentBlockParents.filter((blockParent) => allids.indexOf(blockParent) >= 0 || blockParent == blockid)
                            for (var j = 0; j < currentBlockParents.length; j ++) {
                                const arrowid = layer[i].id + '_' + currentBlockParents[j]
                                const arrowParent = document.querySelector(".arrowid[value='" + arrowid + "']").parentNode;
                                arrowParent.style.left = (arrowParent.getBoundingClientRect().left + window.scrollX) - (drag.getBoundingClientRect().left + window.scrollX) + "px";
                                arrowParent.style.top = (arrowParent.getBoundingClientRect().top + window.scrollY) - (drag.getBoundingClientRect().top + window.scrollY) + "px";
                                drag.appendChild(arrowParent);
                            }
                            
                            foundids.push(layer[i].id);
                            allids.push(layer[i].id);
                        }
                    }
                    if (foundids.length == 0) {
                        flag = true;
                    } else {
                        layer = blocks.filter(a => foundids.some((id) => a.parent.indexOf(id) >= 0));
                        foundids = [];
                    }
                }
                for (var i = 0; i < blocks.filter(a => a.parent.indexOf(blockid) >= 0).length; i++) {
                    var blocknumber = blocks.filter(a => a.parent.indexOf(blockid) >= 0)[i];
                    blocks = blocks.filter(function(e) {
                        return e.id != blocknumber
                    });
                }
                for (var i = 0; i < allids.length; i++) {
                    var blocknumber = allids[i];
                    blocks = blocks.filter(function(e) {
                        return e.id != blocknumber
                    });
                }
                if (blocks.length > 1) {
                    rearrangeMe();
                }
                dragblock = false;
            }
            if (active) {
                drag.style.left = mouse_x - dragx + "px";
                drag.style.top = mouse_y - dragy + "px";
            } else if (rearrange) {
                drag.style.left = mouse_x - dragx - (window.scrollX + absx) + canvas_div.scrollLeft + "px";
                drag.style.top = mouse_y - dragy - (window.scrollY + absy) + canvas_div.scrollTop + "px";
                blockstemp.filter(a => a.id == parseInt(drag.querySelector(".blockid").value)).x = (drag.getBoundingClientRect().left + window.scrollX) + (parseInt(window.getComputedStyle(drag).width) / 2) + canvas_div.scrollLeft;
                blockstemp.filter(a => a.id == parseInt(drag.querySelector(".blockid").value)).y = (drag.getBoundingClientRect().top + window.scrollY) + (parseInt(window.getComputedStyle(drag).height) / 2) + canvas_div.scrollTop;
            }
            if (active || rearrange) {
                if (mouse_x > canvas_div.getBoundingClientRect().width + canvas_div.getBoundingClientRect().left - 10 && mouse_x < canvas_div.getBoundingClientRect().width + canvas_div.getBoundingClientRect().left + 10) {
                    canvas_div.scrollLeft += 10;
                } else if (mouse_x < canvas_div.getBoundingClientRect().left + 10 && mouse_x > canvas_div.getBoundingClientRect().left - 10) {
                    canvas_div.scrollLeft -= 10;
                } else if (mouse_y > canvas_div.getBoundingClientRect().height + canvas_div.getBoundingClientRect().top - 10 && mouse_y < canvas_div.getBoundingClientRect().height + canvas_div.getBoundingClientRect().top + 10) {
                    canvas_div.scrollTop += 10;
                } else if (mouse_y < canvas_div.getBoundingClientRect().top + 10 && mouse_y > canvas_div.getBoundingClientRect().top - 10) {
                    canvas_div.scrollLeft -= 10;
                }
                var xpos = (drag.getBoundingClientRect().left + window.scrollX) + (parseInt(window.getComputedStyle(drag).width) / 2) + canvas_div.scrollLeft - canvas_div.getBoundingClientRect().left;
                var ypos = (drag.getBoundingClientRect().top + window.scrollY) + canvas_div.scrollTop - canvas_div.getBoundingClientRect().top;
                var blocko = blocks.map(a => a.id);
                for (var i = 0; i < blocks.length; i++) {
                    if (checkAttach(blocko[i])) {
                        document.querySelector(".blockid[value='" + blocko[i] + "']").parentNode.appendChild(document.querySelector(".indicator"));
                        document.querySelector(".indicator").style.left = (document.querySelector(".blockid[value='" + blocko[i] + "']").parentNode.offsetWidth / 2) - 5 + "px";
                        document.querySelector(".indicator").style.top = document.querySelector(".blockid[value='" + blocko[i] + "']").parentNode.offsetHeight + "px";
                        document.querySelector(".indicator").classList.remove("invisible");
                        break;
                    } else if (i == blocks.length - 1) {
                        if (!document.querySelector(".indicator").classList.contains("invisible")) {
                            document.querySelector(".indicator").classList.add("invisible");
                        }
                    }
                }
            }
        }

        function checkOffset() {
            offsetleft = blocks.map(a => a.x);
            var widths = blocks.map(a => a.width);
            var mathmin = offsetleft.map(function(item, index) {
                return item - (widths[index] / 2);
            })
            offsetleft = Math.min.apply(Math, mathmin);
            if (offsetleft < (canvas_div.getBoundingClientRect().left + window.scrollX - absx)) {
                var blocko = blocks.map(a => a.id);
                for (var w = 0; w < blocks.length; w++) {
                    document.querySelector(".blockid[value='" + blocks.filter(a => a.id == blocko[w])[0].id + "']").parentNode.style.left = blocks.filter(a => a.id == blocko[w])[0].x - (blocks.filter(a => a.id == blocko[w])[0].width / 2) - offsetleft + canvas_div.getBoundingClientRect().left - absx + 20 + "px";
                    if (blocks.filter(a => a.id == blocko[w])[0].parent != -1) {
                        var arrowblock = blocks.filter(a => a.id == blocko[w])[0];
                        var arrowx = arrowblock.x - blocks.filter(a => a.id == blocks.filter(a => a.id == blocko[w])[0].parent)[0].x;
                        if (arrowx < 0) {
                            document.querySelector('.arrowid[value="' + blocko[w] + '"]').parentNode.style.left = (arrowblock.x - offsetleft + 20 - 5) + canvas_div.getBoundingClientRect().left - absx + "px";
                        } else {
                            document.querySelector('.arrowid[value="' + blocko[w] + '"]').parentNode.style.left = blocks.filter(id => id.id == blocks.filter(a => a.id == blocko[w])[0].parent)[0].x - 20 - offsetleft + canvas_div.getBoundingClientRect().left - absx + 20 + "px";
                        }
                    }
                }
                for (var w = 0; w < blocks.length; w++) {
                    blocks[w].x = (document.querySelector(".blockid[value='" + blocks[w].id + "']").parentNode.getBoundingClientRect().left + window.scrollX) + (canvas_div.scrollLeft) + (parseInt(window.getComputedStyle(document.querySelector(".blockid[value='" + blocks[w].id + "']").parentNode).width) / 2) - 20 - canvas_div.getBoundingClientRect().left;
                }
            }
        }

        function rearrangeMe() {
            var result = blocks.map(a => a.parent);
            for (var z = 0; z < result.length; z++) {
                if (result[z][0] == -1) {
                    z++;
                }
                var totalwidth = 0;
                var totalremove = 0;
                var maxheight = 0;
                for (var w = 0; w < blocks.filter(id => id.parent.indexOf(result[z][0]) >= 0).length; w++) {
                    var children = blocks.filter(id => id.parent.indexOf(result[z][0]) >= 0)[w];
                    if (blocks.filter(id => id.parent.indexOf(children.id) >= 0).length == 0) {
                        children.childwidth = 0;
                    }
                    if (children.childwidth > children.width) {
                        if (w == blocks.filter(id => id.parent.indexOf(result[z][0]) >= 0).length - 1) {
                            totalwidth += children.childwidth;
                        } else {
                            totalwidth += children.childwidth + paddingx;
                        }
                    } else {
                        if (w == blocks.filter(id => id.parent.indexOf(result[z][0]) >= 0).length - 1) {
                            totalwidth += children.width;
                        } else {
                            totalwidth += children.width + paddingx;
                        }
                    }
                }
                if (result[z][0] != -1) {
                    blocks.filter(a => a.id == result[z][0])[0].childwidth = totalwidth;
                }
                for (var w = 0; w < blocks.filter(id => id.parent.indexOf(result[z][0]) >= 0).length; w++) {
                    var children = blocks.filter(id => id.parent.indexOf(result[z][0]) >= 0)[w];
                    const r_block = document.querySelector(".blockid[value='" + children.id + "']").parentNode;
                    const r_array = blocks.filter(id => id.id == result[z][0]);
                    r_block.style.top = r_array.y + paddingy + canvas_div.getBoundingClientRect().top - absy + "px";
                    r_array.y = r_array.y + paddingy;
                    if (children.childwidth > children.width) {
                        r_block.style.left = r_array[0].x - (totalwidth / 2) + totalremove + (children.childwidth / 2) - (children.width / 2) - (absx + window.scrollX) + canvas_div.getBoundingClientRect().left + "px";
                        children.x = r_array[0].x - (totalwidth / 2) + totalremove + (children.childwidth / 2);
                        totalremove += children.childwidth + paddingx;
                    } else {
                        r_block.style.left = r_array[0].x - (totalwidth / 2) + totalremove - (absx + window.scrollX) + canvas_div.getBoundingClientRect().left + "px";
                        children.x = r_array[0].x - (totalwidth / 2) + totalremove + (children.width / 2);
                        totalremove += children.width + paddingx;
                    }

                    for (let x = 0; x < children.parent.length; x ++) {
                        var arrowblock = blocks.filter(a => a.id == children.id)[0];
                        const parentblock = blocks.filter(a => a.id == children.parent[x])[0]
                        var arrowx = arrowblock.x - parentblock.x + 20;
                        var arrowy = arrowblock.y - parentblock.y - arrowblock.height;
                        // var arrowy = paddingy;
                        updateArrow(arrowblock, children.parent[x], arrowx, arrowy, children);
                    }
                }
            }
        }
        
        document.addEventListener("mousedown", flowy.beginDrag);
        document.addEventListener("mousedown", touchblock, false);
        document.addEventListener("touchstart", flowy.beginDrag);
        document.addEventListener("touchstart", touchblock, false);
        document.addEventListener("mouseover", mousehoverblock, false)
        

        document.addEventListener("mouseup", touchblock, false);
        document.addEventListener("mousemove", flowy.moveBlock, false);
        document.addEventListener("touchmove", flowy.moveBlock, false);

        document.addEventListener("mouseup", flowy.endDrag, false);
        document.addEventListener("touchend", flowy.endDrag, false);
    }

    function blockGrabbed(block) {
        grab(block);
    }

    function blockReleased() {
        release();
    }

    function blockSnap(drag, first, parent) {
        return snapping(drag, first, parent);
    }

    function beforeDelete(drag, parent) {
        return rearrange(drag, parent);
    }

    function addEventListenerMulti(type, listener, capture, selector) {
        var nodes = document.querySelectorAll(selector);
        for (var i = 0; i < nodes.length; i++) {
            nodes[i].addEventListener(type, listener, capture);
        }
    }

    function removeEventListenerMulti(type, listener, capture, selector) {
        var nodes = document.querySelectorAll(selector);
        for (var i = 0; i < nodes.length; i++) {
            nodes[i].removeEventListener(type, listener, capture);
        }
    }
    
    flowy.load();
}
