// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface IContestSchedule {
    enum ContestPhase {
        SCHEDULED,    // Запланирован, но еще не начался
        SUBMISSION,   // Прием заявок
        REVIEW,       // Оценка жюри
        COMPLETED,    // Завершен
        CANCELLED     // Отменен
    }
    
    struct Schedule {
        uint256 startTime;        // Время начала конкурса
        uint256 submissionEnd;    // Конец приема заявок
        uint256 reviewEnd;        // Конец оценки (выдача призов)
        uint256 createdAt;        // Время создания
        bool allowEarlyStart;     // Можно ли начать раньше
        bool allowExtension;      // Можно ли продлить
    }
    
    function getContestPhase(uint256 contestId) external view returns (ContestPhase);
    function getSchedule(uint256 contestId) external view returns (Schedule memory);
    function getRemainingTime(uint256 contestId) external view returns (uint256, ContestPhase);
}