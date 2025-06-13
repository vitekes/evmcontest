// Путь: test/integration/ContestLifecycle.test.ts
import {expect} from "chai";
import {ethers} from "hardhat";
import {loadFixture} from "@nomicfoundation/hardhat-network-helpers";
import {time} from "@nomicfoundation/hardhat-toolbox/network-helpers";
import {SignerWithAddress} from "@nomicfoundation/hardhat-ethers/signers";
import {
    createTestContest,
    endContest,
    verifyPrizeClaim,
    createContestTimeParams,
    generateTestJury,
    generateTestWinners
} from "../helpers/ContestHelper";
import {deployContestLifecycleFixture} from "../fixtures/ContestFixture";
import {ContestFactory, ContestEscrow, NetworkFeeManager} from "../../typechain-types";

describe("Contest Lifecycle Integration", function () {
    // Объявление переменных для типизации
    let contestFactory: ContestFactory;
    let networkFeeManager: NetworkFeeManager;
    let owner: SignerWithAddress;
    let creator: SignerWithAddress;
    let winner1: SignerWithAddress;
    let winner2: SignerWithAddress;
    let juryMember: SignerWithAddress;
    let treasury: SignerWithAddress;

    // Перед каждым тестом загружаем фикстуру
    beforeEach(async function () {
        const fixture = await loadFixture(deployContestLifecycleFixture);
        // Присваиваем переменные из фикстуры
        contestFactory = fixture.contestFactory;
        networkFeeManager = fixture.networkFeeManager;
        owner = fixture.owner;
        creator = fixture.creator;
        winner1 = fixture.winner1;
        winner2 = fixture.winner2;
        juryMember = fixture.juryMember;
        treasury = fixture.treasury;
    });

    // Основной тест жизненного цикла конкурса
    it("Полный жизненный цикл конкурса от создания до получения приза", async function () {
        console.log("1. 🚀 Создание конкурса с ETH призом");

        // Определяем параметры конкурса
        const totalPrize = ethers.parseEther("1"); // 1 ETH как приз
        const currentTime = await time.latest();
        const {startTime, endTime} = createContestTimeParams(currentTime, 24, 1); // 24 часа, начало через 1 час

        // Создаем конкурс с двумя местами (60% первому, 40% второму)
        const contestResult = await createTestContest(
            contestFactory,
            networkFeeManager,
            creator,
            {
                token: ethers.ZeroAddress, // ETH
                totalPrize: totalPrize,
                template: 1, // Шаблон с двумя призовыми местами
                startTime: startTime,
                endTime: endTime,
                jury: [juryMember.address], // Добавляем члена жюри
                metadata: {
                    title: "Lifecycle Test Contest",
                    description: "Testing full contest lifecycle"
                }
            }
        );

        const {contestId, escrow, escrowAddress} = contestResult;
        console.log(`Конкурс создан: ID=${contestId}, адрес эскроу=${escrowAddress}`);

        // Проверяем, что конкурс создан
        expect(contestId).to.be.gt(BigInt(0));
        expect(escrowAddress).to.not.equal(ethers.ZeroAddress);

        // Проверяем, что эскроу получил средства
        const escrowBalance = await ethers.provider.getBalance(escrowAddress);
        expect(escrowBalance).to.equal(totalPrize);

        // Проверяем информацию о конкурсе
        const contestInfo = await escrow.getContestInfo();
        expect(contestInfo.contestCreator).to.equal(creator.address);
        expect(contestInfo.totalPrize).to.equal(totalPrize);
        expect(contestInfo.isActive).to.be.false; // Конкурс еще не начался

        // 2. Начало конкурса
        console.log("2. ⏱️ Ожидание начала конкурса");
        await time.increaseTo(Number(startTime) + 10); // Увеличиваем время на 10 секунд после начала

        // Проверяем активность конкурса после начала
        const contestInfoAfterStart = await escrow.getContestInfo();
        expect(contestInfoAfterStart.isActive).to.be.true;

        // 3. Завершение конкурса
        console.log("3. 🏁 Завершение конкурса и проверка статуса");
        await endContest(escrow); // Используем helper для завершения конкурса

        // Проверяем статус после окончания времени
        const contestInfoAfterEnd = await escrow.getContestInfo();
        expect(contestInfoAfterEnd.isActive).to.be.false;
        expect(contestInfoAfterEnd.isFinalized).to.be.false; // Ещё не объявлены победители

        // 4. Объявление победителей
        console.log("4. 🏆 Объявление победителей членом жюри");

        // Получаем распределение призов для проверки правильности сумм
        const distribution = await escrow.getDistribution();
        expect(distribution.length).to.be.gte(2); // У нас должно быть как минимум 2 призовых места

        // Объявляем победителей (winner1 - 1 место, winner2 - 2 место)
        const winners = [winner1.address, winner2.address];
        const places = [1, 2]; // 1-е и 2-е место

        // Объявление победителей от имени члена жюри
        const declareWinnersTx = await escrow.connect(juryMember).declareWinners(winners, places);
        await declareWinnersTx.wait();

        // Проверка, что конкурс финализирован
        const contestInfoAfterFinalize = await escrow.getContestInfo();
        expect(contestInfoAfterFinalize.isFinalized).to.be.true;

        // Получаем объявленных победителей для проверки
        const [declaredWinners,] = await escrow.getWinners();
        expect(declaredWinners.length).to.equal(2);
        expect(declaredWinners[0]).to.equal(winner1.address);
        expect(declaredWinners[1]).to.equal(winner2.address);

        // 5. Получение приза первым победителем
        console.log("5. 💰 Получение приза первым победителем");

        // Получаем сумму приза для первого места
        const expectedPrize1 = (totalPrize * BigInt(distribution[0].percentage)) / BigInt(10000);
        console.log(`Ожидаемый приз для 1-го места: ${ethers.formatEther(expectedPrize1)} ETH`);

        // Проверка получения приза с помощью хелпера
        const actualReceived1 = await verifyPrizeClaim(escrow, winner1, expectedPrize1);
        console.log(`Фактически получено: ${ethers.formatEther(actualReceived1)} ETH`);
        expect(actualReceived1).to.be.approximately(expectedPrize1, BigInt(1e10)); // Допускаем небольшую погрешность

        // 6. Получение приза вторым победителем
        console.log("6. 💰 Получение приза вторым победителем");

        // Получаем сумму приза для второго места
        const expectedPrize2 = (totalPrize * BigInt(distribution[1].percentage)) / BigInt(10000);
        console.log(`Ожидаемый приз для 2-го места: ${ethers.formatEther(expectedPrize2)} ETH`);

        // Проверка получения приза с помощью хелпера
        const actualReceived2 = await verifyPrizeClaim(escrow, winner2, expectedPrize2);
        console.log(`Фактически получено: ${ethers.formatEther(actualReceived2)} ETH`);
        expect(actualReceived2).to.be.approximately(expectedPrize2, BigInt(1e10)); // Допускаем небольшую погрешность

        // 7. Проверка баланса эскроу после выплаты всех призов
        console.log("7. 🧮 Проверка баланса эскроу после выплаты всех призов");
        const escrowBalanceAfter = await ethers.provider.getBalance(escrowAddress);

        // Остаток должен быть минимальным из-за округления при расчетах
        console.log(`Остаток на эскроу: ${ethers.formatEther(escrowBalanceAfter)} ETH`);
        expect(escrowBalanceAfter).to.be.lt(BigInt(1e15)); // Меньше 0.001 ETH

        console.log("✅ Тест жизненного цикла конкурса успешно завершен");
    });

    // Тест на проверку нескольких членов жюри
    it("Корректная работа с несколькими членами жюри", async function () {
        console.log("🧪 Тест с несколькими членами жюри");

        // Создаем конкурс с несколькими членами жюри
        const totalPrize = ethers.parseEther("0.5");
        const currentTime = await time.latest();
        const {startTime, endTime} = createContestTimeParams(currentTime, 24, 1);

        // Массив членов жюри (3 члена жюри)
        const juryMembers = [juryMember.address, owner.address, creator.address];

        const contestResult = await createTestContest(
            contestFactory,
            networkFeeManager,
            creator,
            {
                token: ethers.ZeroAddress,
                totalPrize: totalPrize,
                template: 0, // Шаблон "победитель получает всё"
                startTime: startTime,
                endTime: endTime,
                jury: juryMembers,
                metadata: {
                    title: "Multi-Jury Test Contest",
                    description: "Testing contest with multiple jury members"
                }
            }
        );

        const {escrow} = contestResult;
        console.log("✅ Конкурс с несколькими членами жюри создан");

        // Завершаем конкурс
        await endContest(escrow);

        // Проверяем, что все члены жюри имеют право объявлять победителей
        for (const juryAddress of juryMembers) {
            const isJury = await escrow.isJury(juryAddress);
            expect(isJury).to.be.true;
        }

        // Объявление победителя от имени второго члена жюри (owner)
        const winners = [winner1.address];
        const places = [1];

        const declareWinnersTx = await escrow.connect(owner).declareWinners(winners, places);
        await declareWinnersTx.wait();

        // Проверка, что конкурс финализирован
        const contestInfo = await escrow.getContestInfo();
        expect(contestInfo.isFinalized).to.be.true;

        // Проверяем, что объявленный победитель соответствует ожидаемому
        const [declaredWinners, declaredPlaces] = await escrow.getWinners();
        expect(declaredWinners.length).to.equal(1);
        expect(declaredWinners[0]).to.equal(winner1.address);
        expect(declaredPlaces[0]).to.equal(1);

        console.log("✅ Тест с несколькими членами жюри успешно завершен");
    });

    // Тест на проверку отказа в доступе не авторизованным пользователям
    it("Запрет неавторизованным пользователям объявлять победителей", async function () {
        console.log("🔒 Тест проверки контроля доступа");

        // Создаем конкурс
        const totalPrize = ethers.parseEther("0.5");
        const currentTime = await time.latest();
        const {startTime, endTime} = createContestTimeParams(currentTime, 24, 1);

        const contestResult = await createTestContest(
            contestFactory,
            networkFeeManager,
            creator,
            {
                token: ethers.ZeroAddress,
                totalPrize: totalPrize,
                template: 0,
                startTime: startTime,
                endTime: endTime,
                jury: [juryMember.address], // Только один член жюри
                metadata: {
                    title: "Access Control Test",
                    description: "Testing access control for declaring winners"
                }
            }
        );

        const {escrow} = contestResult;
        console.log("✅ Конкурс для проверки контроля доступа создан");

        // Завершаем конкурс
        await endContest(escrow);

        // Проверяем, что winner1 не является членом жюри
        const isJury = await escrow.isJury(winner1.address);
        expect(isJury).to.be.false;

        // Попытка объявить победителей от имени неавторизованного пользователя
        const winners = [winner2.address];
        const places = [1];

        // Ожидаем, что транзакция будет отклонена
        await expect(
            escrow.connect(winner1).declareWinners(winners, places)
        ).to.be.reverted;

        // Проверяем, что конкурс не финализирован
        const contestInfo = await escrow.getContestInfo();
        expect(contestInfo.isFinalized).to.be.false;

        console.log("✅ Тест контроля доступа успешно завершен");
    });

    // Тест на генерацию случайных членов жюри
    it("Генерация случайных членов жюри", async function () {
        console.log("🎲 Тест генерации случайных членов жюри");

        const juryCount = 5;
        const randomJury = generateTestJury(juryCount);

        // Проверяем, что сгенерировано нужное количество адресов
        expect(randomJury.length).to.equal(juryCount);

        // Проверяем, что все адреса разные
        const uniqueAddresses = new Set(randomJury);
        expect(uniqueAddresses.size).to.equal(juryCount);

        // Проверяем, что все адреса валидные
        for (const address of randomJury) {
            expect(ethers.isAddress(address)).to.be.true;
        }

        // Создаем конкурс со случайными членами жюри
        const totalPrize = ethers.parseEther("0.1");
        const currentTime = await time.latest();
        const {startTime, endTime} = createContestTimeParams(currentTime, 24, 1);

        const contestResult = await createTestContest(
            contestFactory,
            networkFeeManager,
            creator,
            {
                token: ethers.ZeroAddress,
                totalPrize: totalPrize,
                template: 0,
                startTime: startTime,
                endTime: endTime,
                jury: randomJury,
                metadata: {
                    title: "Random Jury Test",
                    description: "Testing with randomly generated jury members"
                }
            }
        );

        const {escrow} = contestResult;

        // Проверяем, что все случайные члены жюри назначены правильно
        for (const juryAddress of randomJury) {
            const isJury = await escrow.isJury(juryAddress);
            expect(isJury).to.be.true;
        }

        console.log("✅ Тест генерации случайных членов жюри успешно завершен");
    });

    // Тест для проверки генерации победителей
    it("Генерация случайных победителей", async function () {
        console.log("🎯 Тест генерации случайных победителей");

        const winnersCount = 3;
        const randomWinners = generateTestWinners(winnersCount);

        // Проверяем, что сгенерировано нужное количество адресов
        expect(randomWinners.length).to.equal(winnersCount);

        // Проверяем, что все адреса разные
        const uniqueAddresses = new Set(randomWinners);
        expect(uniqueAddresses.size).to.equal(winnersCount);

        // Проверяем, что все адреса валидные
        for (const address of randomWinners) {
            expect(ethers.isAddress(address)).to.be.true;
        }

        console.log("✅ Тест генерации случайных победителей успешно завершен");
    });
});

    