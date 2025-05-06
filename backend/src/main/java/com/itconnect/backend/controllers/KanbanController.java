package com.itconnect.backend.controllers;

import com.itconnect.backend.dto.KanbanDto;
import com.itconnect.backend.dto.ResponseDto;
import com.itconnect.backend.entities.User;
import com.itconnect.backend.entities.WorkspaceRole;
import com.itconnect.backend.services.KanbanService;
import com.itconnect.backend.services.WorkspaceService;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/boards")
public class KanbanController {
    
    private final KanbanService kanbanService;
    private final WorkspaceService workspaceService;
    
    public KanbanController(KanbanService kanbanService, WorkspaceService workspaceService) {
        this.kanbanService = kanbanService;
        this.workspaceService = workspaceService;
    }
    
    /**
     * Получить все доски текущего пользователя из всех рабочих областей
     */
    @GetMapping
    public ResponseEntity<?> getAllBoards() {
        User currentUser = getCurrentUser();
        if (currentUser == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body(new ResponseDto("Пользователь не авторизован", false));
        }
        
        List<KanbanDto> boards = kanbanService.getAllBoardsByUser(currentUser);
        return ResponseEntity.ok(boards);
    }
    
    /**
     * Получить все доски из конкретной рабочей области
     */
    @GetMapping("/workspace/{workspaceId}")
    public ResponseEntity<?> getBoardsByWorkspace(@PathVariable("workspaceId") Long workspaceId) {
        User currentUser = getCurrentUser();
        if (currentUser == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body(new ResponseDto("Пользователь не авторизован", false));
        }
        
        List<KanbanDto> boards = kanbanService.getAllBoardsByWorkspace(workspaceId, currentUser);
        return ResponseEntity.ok(boards);
    }
    
    /**
     * Получить доску по ID
     */
    @GetMapping("/{id}")
    public ResponseEntity<?> getBoard(@PathVariable("id") Long id) {
        User currentUser = getCurrentUser();
        if (currentUser == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body(new ResponseDto("Пользователь не авторизован", false));
        }
        
        KanbanDto board = kanbanService.getBoardById(id, currentUser);
        if (board == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(new ResponseDto("Доска не найдена или недостаточно прав для доступа", false));
        }
        
        return ResponseEntity.ok(board);
    }
    
    /**
     * Создать новую доску в рабочей области
     */
    @PostMapping
    public ResponseEntity<?> createBoard(@RequestBody Map<String, Object> request) {
        User currentUser = getCurrentUser();
        if (currentUser == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body(new ResponseDto("Пользователь не авторизован", false));
        }
        
        String name = (String) request.get("name");
        String boardData = (String) request.get("boardData");
        Long workspaceId = Long.valueOf(request.get("workspaceId").toString());
        
        if (name == null || name.trim().isEmpty()) {
            return ResponseEntity.badRequest()
                .body(new ResponseDto("Название доски обязательно", false));
        }
        
        if (boardData == null) {
            boardData = "{}"; // Пустой JSON по умолчанию
        }
        
        KanbanDto createdBoard = kanbanService.createBoard(name, boardData, workspaceId, currentUser);
        if (createdBoard == null) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(new ResponseDto("Недостаточно прав для создания доски в этой рабочей области", false));
        }
        
        return ResponseEntity.status(HttpStatus.CREATED).body(createdBoard);
    }
    
    /**
     * Обновить существующую доску
     */
    @PutMapping("/{id}")
    public ResponseEntity<?> updateBoard(@PathVariable("id") Long id, @RequestBody KanbanDto boardDto) {
        System.out.println("ddddddddddddddddd");
        System.out.println("boardDto: " + boardDto);
        User currentUser = getCurrentUser();
        if (currentUser == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body(new ResponseDto("Пользователь не авторизован", false));
        }
        
        if ((boardDto.getName() == null || boardDto.getName().trim().isEmpty()) 
                && boardDto.getBoardData() == null) {
            return ResponseEntity.badRequest()
                .body(new ResponseDto("Нет данных для обновления", false));
        }
        
        // Получаем текущие данные доски
        KanbanDto existingBoard = kanbanService.getBoardById(id, currentUser);
        if (existingBoard == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(new ResponseDto("Доска не найдена или недостаточно прав для доступа", false));
        }
        
        // Проверяем права на редактирование
        if (!existingBoard.isCanEdit()) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(new ResponseDto("Недостаточно прав для редактирования доски", false));
        }
        
        // Если какие-то параметры не переданы, оставляем текущие значения
        String name = boardDto.getName();
        if (name == null || name.trim().isEmpty()) {
            name = existingBoard.getName();
        }
        
        String boardData = boardDto.getBoardData();
        if (boardData == null) {
            boardData = existingBoard.getBoardData();
        }
        System.out.println("boardData: " + boardData);
        
        KanbanDto updatedBoard = kanbanService.updateBoard(id, name, boardData, currentUser);
        System.out.println("updatedBoarddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd: " + updatedBoard);
        if (updatedBoard == null) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(new ResponseDto("Недостаточно прав для редактирования доски", false));
        }
        
        return ResponseEntity.ok(updatedBoard);
    }
    
    /**
     * Удалить доску
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteBoard(@PathVariable("id") Long id) {
        User currentUser = getCurrentUser();
        if (currentUser == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body(new ResponseDto("Пользователь не авторизован", false));
        }
        
        // Проверяем, существует ли доска и есть ли права на чтение
        KanbanDto board = kanbanService.getBoardById(id, currentUser);
        if (board == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(new ResponseDto("Доска не найдена или недостаточно прав для доступа", false));
        }
        
        boolean deleted = kanbanService.deleteBoard(id, currentUser);
        if (!deleted) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(new ResponseDto("Недостаточно прав для удаления доски", false));
        }
        
        return ResponseEntity.ok(new ResponseDto("Доска успешно удалена", true));
    }
    
    /**
     * Получить текущего аутентифицированного пользователя
     */
    private User getCurrentUser() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication != null && authentication.getPrincipal() instanceof User) {
            return (User) authentication.getPrincipal();
        }
        return null;
    }
} 